#!/usr/bin/env node
/**
 * Store Anne’s 31 Aug SOH export on an Optix freeze, looked up by email.
 * Does not log in as that user. Does not invent DATABASE_URL.
 *
 *   npm run cin7:store-anne-export -- --email toby@example.com --dry-run
 *   npm run cin7:store-anne-export -- --email toby@example.com --confirm-remote
 */

import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { resolveDatabaseUrl } from './database-url.mjs';
import {
  parseStoreAnneCliArgs,
  storeAnneExportByEmail,
} from './lib/store-anne-args.mjs';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

async function findUserByEmail(client, email) {
  const { rows } = await client.query(
    `SELECT id, email FROM app_users WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

function assertCompleteFreeze(row) {
  const summary = row?.summary ?? {};
  const freeze = summary.freeze ?? {};
  const complete =
    row?.status === 'complete' &&
    Boolean(freeze.complete) &&
    !Boolean(freeze.truncated) &&
    Number(freeze.cin7_keys) > 0 &&
    Boolean(freeze.keyset_sha256);
  if (!row || !complete) {
    throw new Error('Capture a complete D10 freeze before storing Anne’s export.');
  }
  return { summary, freeze };
}

function attachAnne(freeze, input) {
  if (!Number.isFinite(input.row_count) || input.row_count <= 0) {
    throw new Error('Anne export row count must be a positive number.');
  }
  if (!Number.isFinite(input.total_quantity)) {
    throw new Error('Anne export total quantity must be a number.');
  }
  if (!Number.isFinite(input.value)) {
    throw new Error('Anne export value must be a number.');
  }
  if (!Number.isFinite(input.nonzero_positions) || input.nonzero_positions <= 0) {
    throw new Error('Anne export non-zero positions must be a positive number.');
  }
  const asOf = new Date(input.as_of);
  if (Number.isNaN(asOf.getTime())) throw new Error('Anne export as-of must be a valid timestamp.');
  return {
    ...freeze,
    anne_export_row_count: Math.floor(input.row_count),
    anne_export_total_quantity: input.total_quantity,
    anne_export_value: input.value,
    anne_export_nonzero_positions: Math.floor(input.nonzero_positions),
    anne_export_per_branch: input.per_branch,
    anne_export_as_of: asOf.toISOString(),
    anne_export_captured_by: input.captured_by,
  };
}

async function loadLatestFreeze(client, ownerUserId) {
  const { rows } = await client.query(
    `SELECT id, status, summary
     FROM cin7_recon_runs
     WHERE owner_user_id = $1 AND mode = 'freeze' AND immutable = true AND status = 'complete'
     ORDER BY checked_at DESC
     LIMIT 1`,
    [ownerUserId]
  );
  return rows[0] ?? null;
}

async function persistAnne(client, ownerUserId, input) {
  const row = await loadLatestFreeze(client, ownerUserId);
  const { summary, freeze } = assertCompleteFreeze(row);
  const next = attachAnne(freeze, input);
  await client.query(
    `UPDATE cin7_recon_runs
     SET summary = $2::jsonb
     WHERE id = $1 AND owner_user_id = $3`,
    [row.id, JSON.stringify({ ...summary, freeze: next }), ownerUserId]
  );
  return { ...next, freeze_id: row.id };
}

async function main() {
  const parsed = parseStoreAnneCliArgs(process.argv.slice(2));
  const resolved = resolveDatabaseUrl();
  if (!resolved?.url || !resolved.parsed) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const remote = !isLocalHost(resolved.parsed.hostname);
  if (remote && !parsed.confirmRemote) {
    throw new Error(
      `Refusing ${resolved.parsed.hostname} without --confirm-remote. This writes Anne’s export onto that account’s freeze.`
    );
  }

  console.log(`database host: ${resolved.parsed.hostname}${remote ? ' (remote)' : ' (local)'}`);
  console.log(`account: ${parsed.email}`);
  console.log(
    `anne: qty=${parsed.input.total_quantity} value=${parsed.input.value} nonzero=${parsed.input.nonzero_positions} rows=${parsed.input.row_count} as_of=${parsed.input.as_of}`
  );

  const client = new pg.Client({
    connectionString: resolved.url,
    ssl: remote ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  try {
    if (parsed.dryRun) {
      const user = await findUserByEmail(client, parsed.email);
      if (!user) throw new Error(`No Optix account for ${parsed.email}.`);
      const row = await loadLatestFreeze(client, user.id);
      const { freeze } = assertCompleteFreeze(row);
      console.log(`dry-run: would store on freeze ${row.id} (${freeze.cin7_keys} keys) for ${user.email}`);
      return;
    }

    const result = await storeAnneExportByEmail({
      email: parsed.email,
      input: parsed.input,
      findUserByEmail: (email) => findUserByEmail(client, email),
      persistAnne: (ownerUserId, input) => persistAnne(client, ownerUserId, input),
    });
    console.log(
      `stored Anne export on freeze ${result.freeze.freeze_id} for ${result.email} (qty ${result.freeze.anne_export_total_quantity}, value ${result.freeze.anne_export_value}, nonzero ${result.freeze.anne_export_nonzero_positions})`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
