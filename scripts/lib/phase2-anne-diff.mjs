/**
 * Anne Cin7 SOH export vs Optix cin7_stock_levels (StockOnHand / stock_on_hand).
 */

import { parseAnneExportFile } from './anne-soh-parse.mjs';
import { PHASE2_ANNE_FIXTURE_2026_09_30, resolveAnneExportPath } from './phase2-anne-fixture.mjs';

export const PHASE2_ANNE_DIFF_USAGE = [
  'Usage:',
  '  npm run cin7:phase2-anne-diff -- --email <account> --anne <export.csv|xlsx> [--out diff.csv]',
  '  npm run cin7:phase2-anne-diff -- --email <account> --anne fixture-2026-09-30 --confirm-remote',
  `  (fixture file: ${PHASE2_ANNE_FIXTURE_2026_09_30})`,
  '',
  'Optix side: cin7_stock_levels.stock_on_hand (Cin7 /v1/Stock StockOnHand).',
  'Anne side: Stock On Hand column from her export — not Available.',
  'Also prints the latest stock-levels sync start/finish from cin7_sync_runs.',
].join('\n');

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parsePhase2AnneDiffCliArgs(argv) {
  let email = '';
  let annePath = '';
  let outPath = '';
  let confirmRemote = false;
  let help = false;
  let includeMatches = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--confirm-remote') {
      confirmRemote = true;
      continue;
    }
    if (arg === '--all-rows') {
      includeMatches = true;
      continue;
    }
    const readOpt = (prefix) => {
      const eq = `${prefix}=`;
      if (arg.startsWith(eq)) return arg.slice(eq.length);
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) throw new Error(`${prefix} requires a value`);
      i += 1;
      return value;
    };
    if (arg === '--email' || arg.startsWith('--email=')) {
      email = readOpt('--email').trim().toLowerCase();
      continue;
    }
    if (arg === '--anne' || arg.startsWith('--anne=')) {
      annePath = resolveAnneExportPath(readOpt('--anne'));
      continue;
    }
    if (arg === '--out' || arg.startsWith('--out=')) {
      outPath = readOpt('--out').trim();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (help) return { help: true, email, annePath, outPath, confirmRemote, includeMatches };
  if (!email) throw new Error('--email is required (the Optix account that owns the stock walk).');
  if (!looksLikeEmail(email)) throw new Error(`--email is not a valid address: ${email}`);
  if (!annePath)
    throw new Error('--anne is required (path to Anne’s Stock On Hand & Availability export).');
  return { help: false, email, annePath, outPath, confirmRemote, includeMatches };
}

function keyOf(sku, branch) {
  return `${branch}\u0000${sku}`;
}

function optixBranchLabel(row) {
  return row.branchName?.trim() || row.cin7BranchId?.trim() || '';
}

/**
 * Same union rules as Area 1, but Anne replaces live Cin7.
 */
export function diffAnneVsOptix(annePositions, optixRows) {
  const anneByKey = new Map();
  for (const row of annePositions) {
    if (!row.sku || !row.branch) continue;
    anneByKey.set(keyOf(row.sku, row.branch.trim()), row);
  }

  const optixByKey = new Map();
  for (const row of optixRows) {
    if (!row.sku) continue;
    const branch = optixBranchLabel(row);
    optixByKey.set(keyOf(row.sku, branch), {
      sku: row.sku,
      branch,
      stockOnHand: Number(row.stockOnHand),
    });
  }

  const seen = new Set();
  const lines = [];
  let missingInOptix = 0;
  let extraInOptix = 0;
  let quantityMismatch = 0;

  const pushLine = (line) => {
    lines.push(line);
    if (line.classification === 'missing_in_optix') missingInOptix += 1;
    else if (line.classification === 'extra_in_optix') extraInOptix += 1;
    else if (line.classification === 'quantity_mismatch') quantityMismatch += 1;
  };

  for (const [k, anne] of anneByKey) {
    seen.add(k);
    const optix = optixByKey.get(k);
    const anneQty = Number(anne.stockOnHand);
    const optixQty = optix ? Number(optix.stockOnHand) : 0;
    const branch = anne.branch.trim();
    const sku = anne.sku.trim();

    if (!optix && anneQty === 0) continue;
    if (!optix && anneQty !== 0) {
      pushLine({
        sku,
        branch,
        anne_qty: anneQty,
        optix_qty: 0,
        difference: -anneQty,
        classification: 'missing_in_optix',
      });
      continue;
    }
    if (optix && optixQty !== anneQty) {
      pushLine({
        sku,
        branch,
        anne_qty: anneQty,
        optix_qty: optixQty,
        difference: optixQty - anneQty,
        classification: 'quantity_mismatch',
      });
      continue;
    }
    if (optix && optixQty === anneQty && anneQty !== 0) {
      pushLine({
        sku,
        branch,
        anne_qty: anneQty,
        optix_qty: optixQty,
        difference: 0,
        classification: 'match',
      });
    }
  }

  for (const [k, optix] of optixByKey) {
    if (seen.has(k) || anneByKey.has(k)) continue;
    if (optix.stockOnHand === 0) continue;
    pushLine({
      sku: optix.sku,
      branch: optix.branch,
      anne_qty: 0,
      optix_qty: optix.stockOnHand,
      difference: optix.stockOnHand,
      classification: 'extra_in_optix',
    });
  }

  lines.sort((a, b) => {
    const bc = a.branch.localeCompare(b.branch);
    if (bc !== 0) return bc;
    return a.sku.localeCompare(b.sku);
  });

  return {
    lines,
    counts: { missingInOptix, extraInOptix, quantityMismatch },
  };
}

export function filterDiffLines(lines, includeMatches) {
  if (includeMatches) return lines;
  return lines.filter((l) => l.classification !== 'match');
}

export function formatDiffSummary(input) {
  const lines = [
    `account: ${input.email}`,
    'optix_field: cin7_stock_levels.stock_on_hand (Cin7 Omni /v1/Stock StockOnHand)',
    'anne_field: Stock On Hand (not Available)',
    `anne_file: ${input.annePath}`,
    `anne_layout: ${input.anneMeta.layout} (${input.anneMeta.rowCount} SKU×branch rows, company SOH ${input.anneMeta.companyTotal})`,
    `optix_keys: ${input.optixKeys} (company SOH ${input.optixCompanyTotal})`,
    `company_difference (optix − anne): ${input.companyDifference}`,
    `variances: missing_in_optix=${input.counts.missingInOptix} extra_in_optix=${input.counts.extraInOptix} quantity_mismatch=${input.counts.quantityMismatch}`,
  ];
  if (input.stockSync) {
    lines.push(
      `stock-levels_sync: status=${input.stockSync.status} started=${input.stockSync.started_at ?? '—'} finished=${input.stockSync.completed_at ?? '—'} records=${input.stockSync.records_processed ?? 0} duration_ms=${input.stockSync.duration_ms ?? 0}`
    );
  } else {
    lines.push('stock-levels_sync: (no cin7_sync_runs row for entity_type stock-levels)');
  }
  if (input.outPath) {
    lines.push(`wrote: ${input.outPath} (${input.writtenRows} rows)`);
  }
  return lines.join('\n');
}

export function diffRowsToCsv(lines) {
  const header = 'sku,branch,anne_stock_on_hand,optix_stock_on_hand,difference,classification';
  const body = lines.map((row) => {
    const esc = (v) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    return [
      esc(row.sku),
      esc(row.branch),
      row.anne_qty,
      row.optix_qty,
      row.difference,
      row.classification,
    ].join(',');
  });
  return [header, ...body].join('\n');
}

export async function runPhase2AnneDiff({
  email,
  annePath,
  outPath,
  includeMatches,
  findUserByEmail,
  queryOptixStock,
  queryStockSyncRun,
}) {
  const anneMeta = await parseAnneExportFile(annePath);
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(
      `No Optix account for ${email}. Use --confirm-remote on the host that holds the stock walk.`
    );
  }
  const optixRows = await queryOptixStock(user.id);
  let optixCompanyTotal = 0;
  for (const row of optixRows) optixCompanyTotal += Number(row.stockOnHand);
  optixCompanyTotal = Math.round(optixCompanyTotal * 1e4) / 1e4;

  const { lines, counts } = diffAnneVsOptix(anneMeta.positions, optixRows);
  const filtered = filterDiffLines(lines, includeMatches);
  const stockSync = await queryStockSyncRun(user.id);

  let writtenRows = 0;
  if (outPath) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outPath, `${diffRowsToCsv(filtered)}\n`, 'utf8');
    writtenRows = filtered.length;
  }

  return {
    email: user.email,
    annePath,
    anneMeta,
    optixKeys: optixRows.length,
    optixCompanyTotal,
    companyDifference: Math.round((optixCompanyTotal - anneMeta.companyTotal) * 1e4) / 1e4,
    counts,
    stockSync,
    outPath: outPath || null,
    writtenRows,
    filtered,
  };
}

export function describePhase2AnneDiffFailure(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
