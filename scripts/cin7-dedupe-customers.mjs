#!/usr/bin/env node
/**
 * UNI-2255: merge duplicate customers left behind before UNI-2252.
 *
 * DRY RUN IS THE DEFAULT AND THE ONLY MODE THIS SCRIPT RUNS WITHOUT THREE
 * EXPLICIT SIGNALS. Executing is a founder-lane decision.
 *
 *   node scripts/cin7-dedupe-customers.mjs --email toby@example.com --out plan.json
 *   node scripts/cin7-dedupe-customers.mjs --email ... --execute --confirm-remote --backup-dir ./backups
 *   node scripts/cin7-dedupe-customers.mjs --rollback ./backups/<file>.json --confirm-remote
 *
 * Execute requires CIN7_ALLOW_DUPLICATE_CLEANUP=true (the same gate as the
 * API route), --execute, and --confirm-remote for a non-local host. It writes
 * a backup file BEFORE the transaction opens; --rollback replays that file.
 */

import { config } from 'dotenv';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { resolveDatabaseUrl } from './database-url.mjs';
import {
  CUSTOMER_FK_TABLES,
  applyPlanInMemory,
  buildPlan,
  planToSql,
  rollbackSql,
} from './lib/dedupe-customers.mjs';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

function parseArgs(argv) {
  const out = {
    email: null,
    out: null,
    execute: false,
    confirmRemote: false,
    backupDir: null,
    rollback: null,
    expectedCin7Count: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i] ?? null;
    else if (a === '--out') out.out = argv[++i] ?? null;
    else if (a === '--execute') out.execute = true;
    else if (a === '--confirm-remote') out.confirmRemote = true;
    else if (a === '--backup-dir') out.backupDir = argv[++i] ?? null;
    else if (a === '--rollback') out.rollback = argv[++i] ?? null;
    else if (a === '--expected-cin7-count') out.expectedCin7Count = Number(argv[++i]);
    else if (a === '--dry-run') out.execute = false;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

async function findOwner(client, email) {
  const { rows } = await client.query(
    'SELECT id, email, workspace_id FROM app_users WHERE lower(email) = lower($1) LIMIT 1',
    [email]
  );
  return rows[0] ?? null;
}

async function loadCustomers(client, ownerUserId) {
  const { rows } = await client.query(
    `SELECT id, owner_user_id AS "ownerUserId", cin7_contact_id AS "cin7ContactId",
            company_name AS "companyName", email, phone, city, created_at AS "createdAt"
     FROM customers WHERE owner_user_id = $1`,
    [ownerUserId]
  );
  return rows;
}

async function loadLinkCounts(client, ids) {
  const counts = {};
  for (const { table } of CUSTOMER_FK_TABLES) {
    const { rows } = await client.query(
      `SELECT customer_id, count(*)::int AS n FROM ${table} WHERE customer_id = ANY($1::uuid[]) GROUP BY 1`,
      [ids]
    );
    for (const row of rows) {
      counts[row.customer_id] = counts[row.customer_id] ?? {};
      counts[row.customer_id][table] = row.n;
    }
  }
  return counts;
}

/**
 * Everything needed to put the losers back exactly as they were. Rows are
 * serialised by Postgres (`to_jsonb`) rather than by node-pg, so a
 * `timestamp without time zone` column round-trips byte-for-byte instead of
 * being parsed as local time and re-emitted as UTC. Called inside the
 * transaction, after the customer rows are locked.
 */
async function takeBackup(client, plan) {
  const losers = plan.merges.flatMap((m) => m.losers);
  const customers = (
    await client.query('SELECT to_jsonb(c) AS row FROM customers c WHERE id = ANY($1::uuid[])', [losers])
  ).rows.map((r) => r.row);
  const fkRows = [];
  const oneToOneRows = [];
  for (const merge of plan.merges) {
    for (const move of merge.moves) {
      const { rows } = await client.query(
        `SELECT to_jsonb(t) AS row FROM ${move.table} t WHERE customer_id = $1`,
        [move.from]
      );
      if (move.action === 'drop') {
        for (const { row } of rows) oneToOneRows.push({ table: move.table, row });
      } else {
        for (const { row } of rows) {
          fkRows.push({ table: move.table, id: row.id, customer_id: row.customer_id });
        }
      }
    }
  }
  return {
    version: 'CCW-CUSTOMER-DEDUPE-BACKUP-V1',
    taken_at: new Date().toISOString(),
    plan_totals: plan.totals,
    customers,
    one_to_one_rows: oneToOneRows,
    fk_rows: fkRows,
  };
}

async function runStatements(client, statements) {
  await client.query('BEGIN');
  try {
    for (const { sql, params } of statements) await client.query(sql, params);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function verifyApplied(client, plan) {
  const losers = plan.merges.flatMap((m) => m.losers);
  const remaining = (
    await client.query('SELECT count(*)::int AS n FROM customers WHERE id = ANY($1::uuid[])', [losers])
  ).rows[0].n;
  let dangling = 0;
  for (const { table } of CUSTOMER_FK_TABLES) {
    dangling += (
      await client.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE customer_id = ANY($1::uuid[])`,
        [losers]
      )
    ).rows[0].n;
  }
  return { remaining_losers: remaining, dangling_references: dangling };
}

function printSummary(plan, expectedCin7Count) {
  const t = plan.totals;
  console.log(`customers now:        ${t.customers}`);
  console.log(`duplicate groups:     ${t.groups}`);
  console.log(`rows to remove:       ${t.losers}`);
  console.log(`expected after:       ${t.expected_after}`);
  if (Number.isFinite(expectedCin7Count)) {
    console.log(`cin7 target:          ${expectedCin7Count} (gap after merge: ${t.expected_after - expectedCin7Count})`);
  }
  console.log(`conflicts (skipped):  ${t.conflicts}`);
  console.log(`no natural key:       ${t.unkeyed}`);
  for (const [table, n] of Object.entries(t.repoints_by_table)) {
    if (n) console.log(`repoint ${table}: ${n}`);
  }
  for (const [table, n] of Object.entries(t.one_to_one_drops)) {
    if (n) console.log(`drop 1:1 ${table}: ${n} (backed up)`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolved = resolveDatabaseUrl();
  if (!resolved?.url || !resolved.parsed) throw new Error('DATABASE_URL is not configured.');

  const remote = !isLocalHost(resolved.parsed.hostname);
  const mutating = args.execute || Boolean(args.rollback);
  if (mutating && remote && !args.confirmRemote) {
    throw new Error(`Refusing to mutate ${resolved.parsed.hostname} without --confirm-remote.`);
  }
  if (mutating && process.env.CIN7_ALLOW_DUPLICATE_CLEANUP?.trim().toLowerCase() !== 'true') {
    throw new Error('Refusing to mutate: CIN7_ALLOW_DUPLICATE_CLEANUP is not "true". This is a founder decision.');
  }
  console.log(`database host: ${resolved.parsed.hostname}${remote ? ' (remote)' : ' (local)'}`);

  const client = new pg.Client({
    connectionString: resolved.url,
    ssl: remote ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  try {
    if (args.rollback) {
      const backup = JSON.parse(readFileSync(args.rollback, 'utf8'));
      if (backup.version !== 'CCW-CUSTOMER-DEDUPE-BACKUP-V1') throw new Error('Not a dedupe backup file.');
      const statements = rollbackSql(backup);
      console.log(`rollback: ${backup.customers.length} customers, ${backup.fk_rows.length} references, ${backup.one_to_one_rows.length} 1:1 rows`);
      await runStatements(client, statements);
      console.log('rollback committed');
      return;
    }

    if (!args.email) throw new Error('--email <owner account email> is required.');
    const owner = await findOwner(client, args.email);
    if (!owner) throw new Error(`No Optix account for ${args.email}.`);

    const customers = await loadCustomers(client, owner.id);
    const linkCounts = await loadLinkCounts(client, customers.map((c) => c.id));
    const plan = buildPlan({ customers, linkCounts });
    printSummary(plan, args.expectedCin7Count);

    const replan = buildPlan(applyPlanInMemory(plan, { customers, linkCounts }));
    if (replan.totals.groups !== 0) {
      throw new Error(`Plan is not idempotent: ${replan.totals.groups} groups would remain.`);
    }

    if (args.out) {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, `${JSON.stringify(plan, null, 2)}\n`);
      console.log(`plan written to ${args.out}`);
    }

    if (!args.execute) {
      console.log('dry-run: no changes made. Re-run with --execute --confirm-remote --backup-dir <dir> to apply.');
      return;
    }
    if (!args.backupDir) throw new Error('--backup-dir is required with --execute.');
    if (plan.totals.losers === 0) {
      console.log('nothing to merge.');
      return;
    }

    // One transaction: lock every customer in the plan so nothing can be
    // linked to a loser between the backup and the delete, take the backup,
    // write it to disk, then apply. A failure anywhere rolls the lot back.
    mkdirSync(args.backupDir, { recursive: true });
    const involved = plan.merges.flatMap((m) => [m.survivor, ...m.losers]);
    let backupPath = null;
    await client.query('BEGIN');
    try {
      await client.query('SELECT id FROM customers WHERE id = ANY($1::uuid[]) FOR UPDATE', [involved]);
      const backup = await takeBackup(client, plan);
      backupPath = join(args.backupDir, `customer-dedupe-${backup.taken_at.replace(/[:.]/g, '-')}.json`);
      writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`);
      console.log(`backup written to ${backupPath} (${backup.customers.length} customers, ${backup.fk_rows.length} references)`);
      for (const { sql, params } of planToSql(plan)) await client.query(sql, params);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    const check = await verifyApplied(client, plan);
    console.log(`applied: remaining losers ${check.remaining_losers}, dangling references ${check.dangling_references}`);
    if (check.remaining_losers !== 0 || check.dangling_references !== 0) {
      throw new Error(`Post-check failed. Roll back with: --rollback ${backupPath} --confirm-remote`);
    }
    const after = (
      await client.query('SELECT count(*)::int AS n FROM customers WHERE owner_user_id = $1', [owner.id])
    ).rows[0].n;
    console.log(`customers after: ${after}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
