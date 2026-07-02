import type { NextRequest } from 'next/server';

const OMNI_API_BASE = 'https://api.cin7.com/api';
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_RETRIES = 2;

type Cin7HttpResult<T> = {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
};

export type Cin7OmniCredentials = {
  username: string;
  apiKey: string;
};

function getCin7RequestTimeoutMs(): number {
  const n = Number(process.env.CIN7_SYNC_HTTP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(n) || n < 1_000) return DEFAULT_TIMEOUT_MS;
  return Math.floor(n);
}

function getCin7RequestRetries(): number {
  const n = Number(process.env.CIN7_SYNC_HTTP_RETRIES || DEFAULT_RETRIES);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_RETRIES;
  return Math.min(5, Math.floor(n));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getCin7OmniCredentials(request?: NextRequest): Cin7OmniCredentials | null {
  const username =
    request?.cookies.get('cin7_omni_username')?.value?.trim() ||
    process.env.CIN7_OMNI_USERNAME?.trim() ||
    '';
  const apiKey =
    request?.cookies.get('cin7_omni_api_key')?.value?.trim() ||
    process.env.CIN7_OMNI_API_KEY?.trim() ||
    process.env.CIN7_OMNI_CONNECTION_KEY?.trim() ||
    '';
  if (!username || !apiKey) return null;
  return { username, apiKey };
}

function basicAuthHeader(creds: Cin7OmniCredentials): string {
  const raw = `${creds.username}:${creds.apiKey}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

export async function cin7OmniGet<T>(
  pathWithQuery: string,
  creds: Cin7OmniCredentials
): Promise<Cin7HttpResult<T>> {
  const base = OMNI_API_BASE.replace(/\/$/, '');
  const p = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  const url = `${base}${p}`;
  const retries = getCin7RequestRetries();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getCin7RequestTimeoutMs());
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: basicAuthHeader(creds),
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as T;
      clearTimeout(timeout);
      return { ok: res.ok, status: res.status, data };
    } catch (error) {
      clearTimeout(timeout);
      const message = getErrorMessage(error);
      if (attempt < retries) {
        await sleep(1_000 * (attempt + 1));
        continue;
      }
      return {
        ok: false,
        status: 504,
        data: {} as T,
        error: `Cin7 Omni request failed: ${message}`,
      };
    }
  }

  return {
    ok: false,
    status: 504,
    data: {} as T,
    error: 'Cin7 Omni request failed after retries.',
  };
}

/** Omni list responses may be a raw array or an envelope with Total + array key. */
function parseOmniListEnvelope(raw: unknown): { rows: unknown[]; total: number | null } {
  if (Array.isArray(raw)) {
    // Cin7 Omni often returns a bare array with no Total — caller must paginate by page size.
    return { rows: raw, total: null };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const total =
      typeof o.Total === 'number'
        ? o.Total
        : typeof o.total === 'number'
          ? o.total
          : typeof o.TotalRecords === 'number'
            ? o.TotalRecords
            : 0;
    const listKeys = [
      'Products',
      'products',
      'Contacts',
      'contacts',
      'SalesOrders',
      'salesOrders',
      'Data',
      'data',
      'Items',
      'items',
    ];
    for (const k of listKeys) {
      const arr = o[k];
      if (Array.isArray(arr)) {
        return { rows: arr, total: total > 0 ? total : null };
      }
    }
  }
  return { rows: [], total: null };
}

/** Lightweight connectivity check (read-only friendly). */
export async function pingCin7Omni(creds: Cin7OmniCredentials): Promise<boolean> {
  const { ok, status, data } = await cin7OmniGet<unknown>('/v1/Products?page=1&rows=1', creds);
  if (!ok || status !== 200) return false;
  const { rows } = parseOmniListEnvelope(data);
  return Array.isArray(rows);
}

function pick<T extends Record<string, unknown>>(row: T, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null) return row[k];
    const lower = k.charAt(0).toLowerCase() + k.slice(1);
    if (lower in row && (row as Record<string, unknown>)[lower] !== undefined) {
      return (row as Record<string, unknown>)[lower];
    }
  }
  return undefined;
}

/** Flatten Omni products into SKU-level rows for ERP import. */
export function flattenOmniProducts(rawList: unknown[]): Array<{
  sku: string;
  name: string;
  price: number;
  stock: number;
}> {
  const out: Array<{ sku: string; name: string; price: number; stock: number }> = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    const styleCode = String(pick(p, 'StyleCode', 'styleCode') ?? '').trim();
    const productName = String(pick(p, 'Name', 'name') ?? styleCode).trim() || 'Product';
    const options = p.ProductOptions ?? p.productOptions;
    if (Array.isArray(options) && options.length > 0) {
      for (const opt of options) {
        if (!opt || typeof opt !== 'object') continue;
        const o = opt as Record<string, unknown>;
        const sku = String(
          pick(o, 'ProductOptionCode', 'productOptionCode', 'Code', 'code') ?? ''
        ).trim();
        if (!sku) continue;
        const optLabel = [o.Option1, o.Option2, o.Option3, o.option1, o.option2, o.option3]
          .filter((x) => x != null && String(x).trim() !== '')
          .map((x) => String(x).trim())
          .join(' ');
        const name = optLabel ? `${productName} (${optLabel})` : productName;
        const price = Number(pick(o, 'RetailPrice', 'retailPrice') ?? 0) || 0;
        const stock = Math.max(
          0,
          Math.floor(Number(pick(o, 'StockAvailable', 'stockAvailable') ?? 0))
        );
        out.push({ sku, name, price, stock });
      }
    } else if (styleCode) {
      out.push({
        sku: styleCode,
        name: productName,
        price: 0,
        stock: 0,
      });
    }
  }
  return out;
}

export async function fetchOmniProductPage(
  creds: Cin7OmniCredentials,
  page: number,
  rows: number
): Promise<{
  rows: ReturnType<typeof flattenOmniProducts>;
  total: number | null;
  /** Raw product records from this page (before SKU flattening). */
  sourceRowCount: number;
  error?: string;
}> {
  const safeRows = Math.max(1, Math.min(250, rows));
  const { ok, data, error } = await cin7OmniGet<unknown>(
    `/v1/Products?page=${page}&rows=${safeRows}`,
    creds
  );
  if (!ok) return { rows: [], total: null, sourceRowCount: 0, error };
  const { rows: rawRows, total } = parseOmniListEnvelope(data);
  const flat = flattenOmniProducts(rawRows);
  return {
    rows: flat,
    total,
    sourceRowCount: rawRows.length,
  };
}

export async function fetchOmniContactsPage(
  creds: Cin7OmniCredentials,
  page: number,
  rows: number
): Promise<{
  rows: Array<{
    companyName: string;
    email: string;
    phone?: string;
    city?: string;
  }>;
  total: number | null;
  sourceRowCount: number;
  error?: string;
}> {
  const safeRows = Math.max(1, Math.min(250, rows));
  const { ok, data, error } = await cin7OmniGet<unknown>(
    `/v1/Contacts?page=${page}&rows=${safeRows}`,
    creds
  );
  if (!ok) return { rows: [], total: null, sourceRowCount: 0, error };
  const { rows: list, total } = parseOmniListEnvelope(data);
  const mapped = list
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const c = raw as Record<string, unknown>;
      const company = String(
        pick(c, 'Company', 'company', 'Name', 'name') ?? 'Cin7 contact'
      ).trim();
      const email = String(pick(c, 'Email', 'email') ?? '').trim();
      const phone = String(pick(c, 'Phone', 'phone', 'Mobile', 'mobile') ?? '').trim() || undefined;
      const city = String(
        pick(c, 'DeliveryCity', 'deliveryCity', 'BillingCity', 'billingCity', 'City', 'city') ?? ''
      ).trim() || undefined;
      return { companyName: company || 'Cin7 contact', email, phone, city };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  return { rows: mapped, total, sourceRowCount: list.length };
}

/** Best-effort sales order total (uses API Total when present). */
export async function fetchOmniSalesOrderCount(creds: Cin7OmniCredentials): Promise<number> {
  const { ok, data } = await cin7OmniGet<unknown>(`/v1/SalesOrders?page=1&rows=1`, creds);
  if (!ok) return 0;
  const { total, rows } = parseOmniListEnvelope(data);
  if (total != null && total > 0) return total;
  return rows.length;
}
