#!/usr/bin/env node
/**
 * List every Optix account, then delete only the ones you pick.
 * Not limited to mailinator / demo.
 *
 *   npm run list-accounts
 *   npx list-accounts
 *
 * After the list, type numbers and/or emails (comma or space separated).
 * Empty line cancels. Accounts that own customers are skipped unless
 * you pass --force-delete-with-data.
 *
 * Remote / production is refused unless you pass --confirm-remote.
 */

import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { resolveDatabaseUrl } from './database-url.mjs';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

function parseArgs(argv) {
  let confirmRemote = false;
  let forceDeleteWithData = false;
  let listOnly = false;
  const emails = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--confirm-remote') confirmRemote = true;
    else if (arg === '--force-delete-with-data') forceDeleteWithData = true;
    else if (arg === '--list') listOnly = true;
    else if (arg === '--email') {
      const value = argv[i + 1];
      if (!value) throw new Error('--email requires an address');
      emails.push(value.trim().toLowerCase());
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { confirmRemote, forceDeleteWithData, listOnly, emails };
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function printAccounts(rows) {
  console.log(`accounts: ${rows.length}`);
  rows.forEach((row, index) => {
    console.log(
      `${String(index + 1).padStart(3, ' ')}. ${row.email} · ${
        row.is_active ? 'active' : 'disabled'
      } · customers=${row.customers}`
    );
  });
}

function resolveSelection(rows, raw) {
  const tokens = raw
    .split(/[\s,]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const selected = [];
  const unknown = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      const row = rows[Number(token) - 1];
      if (row) selected.push(row);
      else unknown.push(token);
      continue;
    }
    const row = rows.find((item) => item.email.toLowerCase() === token);
    if (row) selected.push(row);
    else unknown.push(token);
  }
  const seen = new Set();
  return {
    selected: selected.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }),
    unknown,
  };
}

async function deleteRows(client, rows, forceDeleteWithData) {
  for (const row of rows) {
    if (row.customers > 0 && !forceDeleteWithData) {
      console.log(
        `skipped ${row.email}: owns ${row.customers} customers. Pass --force-delete-with-data to delete it.`
      );
      continue;
    }
    await client.query('DELETE FROM app_users WHERE id = $1', [row.id]);
    console.log(`removed ${row.email}`);
  }
}

async function promptSelection(rows) {
  if (!input.isTTY || !output.isTTY) {
    console.log('No TTY — printed the list only. Re-run in a terminal, or pass --email addr.');
    return [];
  }
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      'Delete which accounts? Type numbers and/or emails (comma or space). Empty = cancel.\n> '
    );
    if (!answer.trim()) {
      console.log('cancelled');
      return [];
    }
    const { selected, unknown } = resolveSelection(rows, answer);
    if (unknown.length) console.log(`not found: ${unknown.join(', ')}`);
    return selected;
  } finally {
    rl.close();
  }
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
    const { rows } = await client.query(`
      SELECT
        u.id,
        u.email,
        u.is_active,
        (SELECT count(*)::int FROM customers c WHERE c.owner_user_id = u.id) AS customers
      FROM app_users u
      ORDER BY u.email
    `);
    if (rows.length === 0) {
      console.log('no accounts');
      return;
    }

    printAccounts(rows);

    if (parsed.listOnly) return;

    if (parsed.emails.length) {
      const { selected, unknown } = resolveSelection(rows, parsed.emails.join(','));
      if (unknown.length) console.log(`not found: ${unknown.join(', ')}`);
      await deleteRows(client, selected, parsed.forceDeleteWithData);
      return;
    }

    const picked = await promptSelection(rows);
    if (picked.length === 0) return;
    await deleteRows(client, picked, parsed.forceDeleteWithData);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
