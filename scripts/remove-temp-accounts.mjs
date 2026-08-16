#!/usr/bin/env node
/**
 * Remove throwaway Optix accounts (mailinator / demo).
 *
 * Never points at production by itself. A remote DATABASE_URL is refused
 * unless you pass --confirm-remote.
 *
 *   npm run removetemp-accounts
 *   npm run removetemp-accounts -- --list
 *   npx removetemp-accounts
 *   npx removetemp-accounts -- --list
 *
 * Production (you supply the URL; this script will not invent one):
 *
 *   DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run removetemp-accounts -- --confirm-remote --list
 *   DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run removetemp-accounts -- --confirm-remote
 */

import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { resolveDatabaseUrl } from './database-url.mjs';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const TEMP_DOMAINS = ['mailinator.com', 'demo.com'];

function parseArgs(argv) {
  let listOnly = false;
  let confirmRemote = false;
  let forceDeleteWithData = false;
  const extraEmails = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--list') listOnly = true;
    else if (arg === '--confirm-remote') confirmRemote = true;
    else if (arg === '--force-delete-with-data') forceDeleteWithData = true;
    else if (arg === '--email') {
      const value = argv[i + 1];
      if (!value) throw new Error('--email requires an address');
      extraEmails.push(value.trim().toLowerCase());
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { listOnly, confirmRemote, forceDeleteWithData, extraEmails };
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

async function loadTempAccounts(client, extraEmails) {
  const { rows } = await client.query(
    `
      SELECT
        u.id,
        u.email,
        u.is_active,
        (SELECT count(*)::int FROM customers c WHERE c.owner_user_id = u.id) AS customers
      FROM app_users u
      WHERE lower(u.email) LIKE ANY($1::text[])
         OR lower(u.email) = ANY($2::text[])
      ORDER BY u.email
    `,
    [TEMP_DOMAINS.map((domain) => `%@${domain}`), extraEmails]
  );
  return rows;
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  const resolved = resolveDatabaseUrl();
  if (!resolved?.url || !resolved.parsed) {
    console.error('DATABASE_URL is not configured.');
    process.exitCode = 1;
    return;
  }

  const remote = !isLocalHost(resolved.parsed.hostname);
  if (remote && !parsed.confirmRemote) {
    console.error(
      `Refusing ${resolved.parsed.hostname} without --confirm-remote. This command does not run against production unless you pass that flag.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`database host: ${resolved.parsed.hostname}${remote ? ' (remote)' : ' (local)'}`);

  const client = new pg.Client({
    connectionString: resolved.url,
    ssl: remote ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  try {
    const rows = await loadTempAccounts(client, parsed.extraEmails);
    if (rows.length === 0) {
      console.log('no matching temp accounts');
      return;
    }
    if (parsed.listOnly) {
      console.log(`temp accounts: ${rows.length}`);
      for (const row of rows) {
        console.log(
          `${row.email} · ${row.is_active ? 'active' : 'disabled'} · customers=${row.customers}`
        );
      }
      return;
    }
    for (const row of rows) {
      if (row.customers > 0 && !parsed.forceDeleteWithData) {
        console.log(
          `skipped ${row.email}: owns ${row.customers} customers. Disable it by hand, or pass --force-delete-with-data.`
        );
        continue;
      }
      await client.query('DELETE FROM app_users WHERE id = $1', [row.id]);
      console.log(`removed ${row.email}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
