#!/usr/bin/env node
/**
 * Full SKU×branch diff: Anne’s Cin7 SOH export vs Optix stock_on_hand.
 *
 *   npm run cin7:phase2-anne-diff -- --email you@example.com --anne ./Anne.xlsx --out diff.csv
 *   npm run cin7:phase2-anne-diff -- --email you@example.com --anne ./Anne.csv --confirm-remote
 */

import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { resolveDatabaseUrl } from './database-url.mjs';
import {
  PHASE2_ANNE_DIFF_USAGE,
  describePhase2AnneDiffFailure,
  formatDiffSummary,
  parsePhase2AnneDiffCliArgs,
  runPhase2AnneDiff,
} from './lib/phase2-anne-diff.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env'), quiet: true });
config({ path: join(root, '.env.local'), quiet: true, override: true });

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error(PHASE2_ANNE_DIFF_USAGE);
    process.exitCode = 1;
    return;
  }

  const parsed = parsePhase2AnneDiffCliArgs(argv);
  if (parsed.help) {
    console.error(PHASE2_ANNE_DIFF_USAGE);
    return;
  }

  const resolved = resolveDatabaseUrl();
  if (!resolved?.url || !resolved.parsed) {
    throw new Error(
      'DATABASE_URL is not configured. Set it in .env (or DB_HOST / DB_USER / DB_PASSWORD).'
    );
  }

  const remote = !isLocalHost(resolved.parsed.hostname);
  if (remote && !parsed.confirmRemote) {
    throw new Error(
      `Refusing ${resolved.parsed.hostname} without --confirm-remote. This reads that account’s stock rows.`
    );
  }

  console.log(`database host: ${resolved.parsed.hostname}${remote ? ' (remote)' : ' (local)'}`);

  const client = new pg.Client({
    connectionString: resolved.url,
    ssl: remote ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 15_000,
  });

  try {
    await client.connect();
    const result = await runPhase2AnneDiff({
      email: parsed.email,
      annePath: parsed.annePath,
      outPath: parsed.outPath,
      includeMatches: parsed.includeMatches,
      findUserByEmail: async (email) => {
        const { rows } = await client.query(
          `SELECT id, email FROM app_users WHERE lower(email) = lower($1) LIMIT 1`,
          [email]
        );
        return rows[0] ?? null;
      },
      queryOptixStock: async (ownerUserId) => {
        const { rows } = await client.query(
          `SELECT sku,
                  cin7_branch_id AS "cin7BranchId",
                  branch_name AS "branchName",
                  stock_on_hand AS "stockOnHand"
           FROM cin7_stock_levels
           WHERE owner_user_id = $1`,
          [ownerUserId]
        );
        return rows;
      },
      queryStockSyncRun: async (ownerUserId) => {
        const { rows } = await client.query(
          `SELECT entity_type,
                  status,
                  started_at,
                  completed_at,
                  records_processed,
                  duration_ms
           FROM cin7_sync_runs
           WHERE owner_user_id = $1 AND entity_type = 'stock-levels'
           LIMIT 1`,
          [ownerUserId]
        );
        const row = rows[0];
        if (!row) return null;
        return {
          status: row.status,
          started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
          completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
          records_processed: row.records_processed,
          duration_ms: row.duration_ms,
        };
      },
    });

    console.log(formatDiffSummary(result));

    if (!parsed.outPath && result.filtered.length > 0) {
      console.log('\n(first 20 variance rows — use --out for full CSV)');
      for (const row of result.filtered.slice(0, 20)) {
        console.log(
          `${row.sku}\t${row.branch}\tanne=${row.anne_qty}\toptix=${row.optix_qty}\tdiff=${row.difference}\t${row.classification}`
        );
      }
      if (result.filtered.length > 20) {
        console.log(`… ${result.filtered.length - 20} more (use --out)`);
      }
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(describePhase2AnneDiffFailure(error));
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('--email') || message.includes('--anne') || message.startsWith('Unknown argument:')) {
    console.error(PHASE2_ANNE_DIFF_USAGE);
  }
  process.exitCode = 1;
});
