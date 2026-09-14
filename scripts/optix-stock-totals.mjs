#!/usr/bin/env node
/**
 * Print Optix stock control totals for one account.
 * Does not invent DATABASE_URL. Does not print the connection string.
 *
 *   npm run cin7:optix-stock-totals -- --email tobyb@ccwarehouse.com.au
 *   npm run cin7:optix-stock-totals -- --email tobyb@ccwarehouse.com.au --confirm-remote
 */

import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { resolveDatabaseUrl } from './database-url.mjs';
import {
  formatOptixStockTotals,
  loadOptixStockTotals,
  parseOptixStockTotalsCliArgs,
} from './lib/optix-stock-totals.mjs';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

async function main() {
  const parsed = parseOptixStockTotalsCliArgs(process.argv.slice(2));
  const resolved = resolveDatabaseUrl();
  if (!resolved?.url || !resolved.parsed) {
    throw new Error('DATABASE_URL is not configured.');
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
  });
  await client.connect();
  try {
    const result = await loadOptixStockTotals({
      email: parsed.email,
      findUserByEmail: async (email) => {
        const { rows } = await client.query(
          `SELECT id, email FROM app_users WHERE lower(email) = lower($1) LIMIT 1`,
          [email]
        );
        return rows[0] ?? null;
      },
      queryTotals: async (ownerUserId) => {
        const { rows } = await client.query(
          `SELECT COUNT(*)::int AS keys,
                  COALESCE(SUM(stock_on_hand), 0)::bigint AS qty,
                  COUNT(*) FILTER (WHERE stock_on_hand > 0)::int AS nonzero
           FROM cin7_stock_levels
           WHERE owner_user_id = $1`,
          [ownerUserId]
        );
        return rows[0];
      },
      queryPerBranch: async (ownerUserId) => {
        const { rows } = await client.query(
          `SELECT COALESCE(NULLIF(BTRIM(branch_name), ''), cin7_branch_id) AS branch,
                  COALESCE(SUM(stock_on_hand), 0)::bigint AS qty,
                  COUNT(*) FILTER (WHERE stock_on_hand > 0)::int AS nonzero
           FROM cin7_stock_levels
           WHERE owner_user_id = $1
           GROUP BY 1
           ORDER BY SUM(stock_on_hand) DESC, branch ASC`,
          [ownerUserId]
        );
        return rows;
      },
    });
    console.log(formatOptixStockTotals(result));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
