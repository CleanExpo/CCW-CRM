/**
 * Parse Anne’s Cin7 “Stock On Hand & Availability” export (CSV or XLSX).
 * Uses Stock On Hand only — not Available.
 */

const SKU_HEADERS = [
  'style code',
  'product code',
  'sku',
  'code',
  'product option code',
  'productoptioncode',
];

const BRANCH_HEADERS = ['branch', 'branch name', 'location', 'warehouse', 'branchname'];

const SOH_HEADERS = ['stock on hand', 'stockonhand', 'on hand', 'soh', 'stock on hand qty'];

const BRANCH_COLUMN_HINT = /^(CCW|PFS|POWERFORCE|Shopify)/i;

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function findColumnIndex(headers, aliases) {
  for (let i = 0; i < headers.length; i += 1) {
    const h = normalizeHeader(headers[i]);
    if (aliases.includes(h)) return i;
  }
  for (let i = 0; i < headers.length; i += 1) {
    const h = normalizeHeader(headers[i]);
    if (aliases.some((a) => h.includes(a))) return i;
  }
  return -1;
}

function parseQty(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim().replace(/,/g, '');
  if (!text) return 0;
  const n = Number(text);
  if (!Number.isFinite(n)) {
    throw new Error(`Could not parse quantity: ${JSON.stringify(value)}`);
  }
  return n;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function sheetRowsFromCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  return lines.map(parseCsvLine);
}

async function loadXlsxModule() {
  try {
    const mod = await import('xlsx');
    return mod.default ?? mod;
  } catch {
    throw new Error(
      'Reading .xlsx requires the xlsx package (npm install xlsx). Or save Anne’s export as CSV and pass that path.'
    );
  }
}

async function sheetRowsFromXlsx(filePath) {
  const XLSX = await loadXlsxModule();
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Anne export workbook has no sheets.');
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  return rows.filter((row) => Array.isArray(row) && row.some((c) => String(c ?? '').trim() !== ''));
}

export async function loadAnneExportRows(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.csv')) {
    const { readFile } = await import('node:fs/promises');
    const text = await readFile(filePath, 'utf8');
    return sheetRowsFromCsv(text);
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return sheetRowsFromXlsx(filePath);
  }
  throw new Error('Anne export must be .csv, .xlsx, or .xls');
}

function findCin7SohQtyColumn(headers, subHeaders) {
  for (let i = 0; i < headers.length; i += 1) {
    const metric = normalizeHeader(subHeaders?.[i] ?? '');
    const label = normalizeHeader(headers[i]);
    if (metric !== 'soh') continue;
    if (label === 'stock qty' || label.includes('stock qty')) return i;
  }
  return -1;
}

function detectHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 15); r += 1) {
    const headers = rows[r].map((c) => String(c ?? '').trim());
    const skuIdx = findColumnIndex(headers, SKU_HEADERS);
    const branchIdx = findColumnIndex(headers, BRANCH_HEADERS);
    let sohIdx = findColumnIndex(headers, SOH_HEADERS);
    const wideBranches = headers.filter((h) => BRANCH_COLUMN_HINT.test(String(h ?? '').trim()));
    if (skuIdx >= 0 && branchIdx >= 0 && sohIdx >= 0) {
      return { headerRow: r, layout: 'long', skuIdx, branchIdx, sohIdx, wideBranches: [] };
    }
    if (skuIdx >= 0 && branchIdx >= 0 && sohIdx < 0 && r > 0) {
      const subHeaders = rows[r - 1]?.map((c) => String(c ?? '').trim()) ?? [];
      sohIdx = findCin7SohQtyColumn(headers, subHeaders);
      if (sohIdx >= 0) {
        return {
          headerRow: r,
          layout: 'long-cin7-soh',
          skuIdx,
          branchIdx,
          sohIdx,
          wideBranches: [],
        };
      }
    }
    if (skuIdx >= 0 && wideBranches.length >= 2) {
      return { headerRow: r, layout: 'wide', skuIdx, branchIdx: -1, sohIdx: -1, wideBranches };
    }
  }
  throw new Error(
    'Could not find SKU / branch / Stock On Hand columns in Anne export. Expected Cin7 “Stock On Hand & Availability” headers.'
  );
}

/**
 * @returns {{ positions: Array<{ sku: string, branch: string, stockOnHand: number }>, rowCount: number, companyTotal: number }}
 */
export function parseAnneStockOnHand(rows) {
  const { headerRow, layout, skuIdx, branchIdx, sohIdx, wideBranches } = detectHeaderRow(rows);
  const headers = rows[headerRow].map((c) => String(c ?? '').trim());
  const positions = [];

  if (layout === 'long' || layout === 'long-cin7-soh') {
    for (let r = headerRow + 1; r < rows.length; r += 1) {
      const row = rows[r];
      if (!row) continue;
      const sku = String(row[skuIdx] ?? '').trim();
      const branch = String(row[branchIdx] ?? '').trim();
      if (!sku || !branch) continue;
      const stockOnHand = parseQty(row[sohIdx]);
      positions.push({ sku, branch, stockOnHand });
    }
  } else {
    for (let r = headerRow + 1; r < rows.length; r += 1) {
      const row = rows[r];
      if (!row) continue;
      const sku = String(row[skuIdx] ?? '').trim();
      if (!sku) continue;
      for (const branchHeader of wideBranches) {
        const col = headers.indexOf(branchHeader);
        if (col < 0) continue;
        const stockOnHand = parseQty(row[col]);
        positions.push({ sku, branch: branchHeader.trim(), stockOnHand });
      }
    }
  }

  let companyTotal = 0;
  for (const p of positions) companyTotal += p.stockOnHand;
  return {
    positions,
    rowCount: positions.length,
    companyTotal: Math.round(companyTotal * 1e4) / 1e4,
    headers: headers.filter(Boolean),
    layout,
  };
}

export async function parseAnneExportFile(filePath) {
  const rows = await loadAnneExportRows(filePath);
  if (rows.length === 0) throw new Error('Anne export file is empty.');
  return parseAnneStockOnHand(rows);
}
