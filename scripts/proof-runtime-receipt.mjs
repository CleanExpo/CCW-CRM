#!/usr/bin/env node
/**
 * Produce a redacted, hashed runtime receipt for the CCW proof packet.
 *
 *   npm run proof:runtime-receipt
 *   E2E_BASE_URL=https://ccw-crm-web.vercel.app npm run proof:runtime-receipt -- --out receipts/health.json
 *
 * With E2E_EMAIL and E2E_PASSWORD set it also records whether login yields a
 * session (status + cookie-set flag only). Exit code is 0 for a healthy
 * receipt and 2 for an unhealthy one, so a pipeline can gate on it.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { collectRuntimeReceipt } from './lib/runtime-receipt.mjs';

function parseArgs(argv) {
  const out = { outPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') {
      out.outPath = argv[i + 1] ?? null;
      i += 1;
    }
  }
  return out;
}

const { outPath } = parseArgs(process.argv.slice(2));
const baseUrl = process.env.E2E_BASE_URL || 'https://ccw-crm-web.vercel.app';
const credentials =
  process.env.E2E_EMAIL && process.env.E2E_PASSWORD
    ? { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD }
    : null;

const receipt = await collectRuntimeReceipt({ baseUrl, credentials });
const text = `${JSON.stringify(receipt, null, 2)}\n`;

if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
  console.log(`receipt written to ${outPath}`);
}
process.stdout.write(text);
process.exitCode = receipt.verdict === 'healthy' ? 0 : 2;
