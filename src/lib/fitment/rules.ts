/**
 * UNI-2748: pure rules for the machine-to-consumables and parts map.
 * No database access here, so every rule is testable without one.
 */

export const FITMENT_KINDS = ['consumable', 'part', 'accessory'] as const;
export type FitmentKind = (typeof FITMENT_KINDS)[number];

export const FITMENT_STATUSES = ['suggested', 'confirmed', 'rejected'] as const;
export type FitmentStatus = (typeof FITMENT_STATUSES)[number];

export type FitmentSource = 'manual' | 'import' | 'bom' | 'order_history';

/** Who is reading. Customers only ever see rows a staff member confirmed. */
export type FitmentAudience = 'staff' | 'customer';

export function statusesVisibleTo(audience: FitmentAudience): FitmentStatus[] {
  return audience === 'customer' ? ['confirmed'] : ['suggested', 'confirmed'];
}

export function isFitmentKind(v: unknown): v is FitmentKind {
  return typeof v === 'string' && (FITMENT_KINDS as readonly string[]).includes(v);
}

export function isFitmentStatus(v: unknown): v is FitmentStatus {
  return typeof v === 'string' && (FITMENT_STATUSES as readonly string[]).includes(v);
}

// ─── Spreadsheet import ──────────────────────────────────────────────────────

export type ImportRow = {
  line: number;
  machineSku: string;
  fitSku: string;
  kind: FitmentKind;
  usageQuantity: number | null;
  usagePer: string | null;
};

export type ImportError = { line: number; message: string };

const REQUIRED_HEADERS = ['machine_sku', 'fit_sku', 'kind'] as const;

/** Splits one CSV line, honouring double-quoted fields and "" escapes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Parses the sheet Toby's team fills in. Columns: machine_sku, fit_sku, kind,
 * and optionally usage_quantity, usage_per. Bad rows are reported, never guessed.
 */
export function parseFitmentCsv(text: string): { rows: ImportRow[]; errors: ImportError[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  const headerIdx = lines.findIndex((l) => l.trim() !== '');
  if (headerIdx === -1) return { rows, errors: [{ line: 1, message: 'File is empty' }] };

  const headers = splitCsvLine(lines[headerIdx]).map((h) => h.toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      rows,
      errors: [{ line: headerIdx + 1, message: `Missing column(s): ${missing.join(', ')}` }],
    };
  }
  const col = (name: string) => headers.indexOf(name);

  const seen = new Set<string>();
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const line = i + 1;
    const cells = splitCsvLine(lines[i]);
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? '') : '');
    const machineSku = get('machine_sku');
    const fitSku = get('fit_sku');
    const kind = get('kind').toLowerCase();
    if (!machineSku || !fitSku) {
      errors.push({ line, message: 'machine_sku and fit_sku are required' });
      continue;
    }
    if (machineSku === fitSku) {
      errors.push({ line, message: 'A product cannot fit itself' });
      continue;
    }
    if (!isFitmentKind(kind)) {
      errors.push({ line, message: `kind must be one of ${FITMENT_KINDS.join(', ')}` });
      continue;
    }
    const rawQty = get('usage_quantity');
    let usageQuantity: number | null = null;
    if (rawQty !== '') {
      const n = Number(rawQty);
      if (!Number.isFinite(n) || n <= 0) {
        errors.push({ line, message: 'usage_quantity must be a positive number' });
        continue;
      }
      usageQuantity = n;
    }
    const key = JSON.stringify([machineSku, fitSku]);
    if (seen.has(key)) {
      errors.push({ line, message: 'Duplicate machine_sku and fit_sku pair' });
      continue;
    }
    seen.add(key);
    rows.push({
      line,
      machineSku,
      fitSku,
      kind,
      usageQuantity,
      usagePer: get('usage_per') || null,
    });
  }
  return { rows, errors };
}

// ─── Suggestions from past orders ────────────────────────────────────────────

export type OrderForSuggestion = {
  customerId: string;
  createdAt: Date;
  productIds: string[];
};

export type Suggestion = {
  machineProductId: string;
  fitProductId: string;
  buyers: number;
  machineBuyers: number;
};

/**
 * For each machine, counts how many distinct customers who bought it later
 * bought each other product. A pair is suggested when at least `minBuyers`
 * machine buyers did so and they are at least `minShare` of all its buyers.
 * Other machines are never suggested as fitting a machine.
 */
export function suggestFromOrderHistory(
  orders: OrderForSuggestion[],
  machineProductIds: Set<string>,
  opts: { minBuyers?: number; minShare?: number } = {}
): Suggestion[] {
  const minBuyers = opts.minBuyers ?? 2;
  const minShare = opts.minShare ?? 0.25;

  // First purchase date of each machine per customer.
  const firstBuy = new Map<string, Map<string, number>>(); // machine -> customer -> ts
  for (const o of orders) {
    for (const pid of o.productIds) {
      if (!machineProductIds.has(pid)) continue;
      const byCustomer = firstBuy.get(pid) ?? new Map<string, number>();
      const ts = o.createdAt.getTime();
      const prev = byCustomer.get(o.customerId);
      if (prev === undefined || ts < prev) byCustomer.set(o.customerId, ts);
      firstBuy.set(pid, byCustomer);
    }
  }

  const out: Suggestion[] = [];
  for (const [machineId, byCustomer] of firstBuy) {
    const buyersByProduct = new Map<string, Set<string>>();
    for (const o of orders) {
      const since = byCustomer.get(o.customerId);
      if (since === undefined || o.createdAt.getTime() <= since) continue;
      for (const pid of o.productIds) {
        if (pid === machineId || machineProductIds.has(pid)) continue;
        const set = buyersByProduct.get(pid) ?? new Set<string>();
        set.add(o.customerId);
        buyersByProduct.set(pid, set);
      }
    }
    const machineBuyers = byCustomer.size;
    for (const [fitId, customers] of buyersByProduct) {
      if (customers.size >= minBuyers && customers.size / machineBuyers >= minShare) {
        out.push({
          machineProductId: machineId,
          fitProductId: fitId,
          buyers: customers.size,
          machineBuyers,
        });
      }
    }
  }
  return out.sort((a, b) => b.buyers - a.buyers);
}
