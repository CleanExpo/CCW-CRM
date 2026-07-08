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
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(2_000 * (attempt + 1));
        continue;
      }
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
      'Branches',
      'branches',
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
export function flattenOmniProducts(
  rawList: unknown[],
  options?: { excludeInactive?: boolean }
): Array<{
  sku: string;
  name: string;
  price: number;
  stock: number;
  visibility: string;
  styleCode: string;
  isActive: boolean;
}> {
  const excludeInactive = options?.excludeInactive === true;
  const out: Array<{
    sku: string;
    name: string;
    price: number;
    stock: number;
    visibility: string;
    styleCode: string;
    isActive: boolean;
  }> = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    const styleStatus = String(pick(p, 'Status', 'status') ?? 'Public').trim() || 'Public';
    if (excludeInactive && styleStatus === 'Inactive') continue;

    const styleCode = String(pick(p, 'StyleCode', 'styleCode') ?? '').trim();
    const productName = String(pick(p, 'Name', 'name') ?? styleCode).trim() || 'Product';
    const optionsList = p.ProductOptions ?? p.productOptions;
    if (Array.isArray(optionsList) && optionsList.length > 0) {
      for (const opt of optionsList) {
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
        out.push({
          sku,
          name,
          price,
          stock,
          visibility: styleStatus,
          styleCode: styleCode || sku,
          isActive: styleStatus !== 'Inactive',
        });
      }
    } else if (styleCode) {
      out.push({
        sku: styleCode,
        name: productName,
        price: 0,
        stock: 0,
        visibility: styleStatus,
        styleCode,
        isActive: styleStatus !== 'Inactive',
      });
    }
  }
  return out;
}

export async function fetchOmniProductPage(
  creds: Cin7OmniCredentials,
  page: number,
  rows: number,
  options?: { excludeInactive?: boolean }
): Promise<{
  rows: ReturnType<typeof flattenOmniProducts>;
  total: number | null;
  /** Raw product records from this page (before SKU flattening). */
  sourceRowCount: number;
  skippedInactive: number;
  error?: string;
}> {
  const safeRows = Math.max(1, Math.min(250, rows));
  const { ok, data, error } = await cin7OmniGet<unknown>(
    `/v1/Products?page=${page}&rows=${safeRows}`,
    creds
  );
  if (!ok) {
    return { rows: [], total: null, sourceRowCount: 0, skippedInactive: 0, error };
  }
  const { rows: rawRows, total } = parseOmniListEnvelope(data);
  const excludeInactive = options?.excludeInactive === true;
  let skippedInactive = 0;
  if (excludeInactive) {
    for (const raw of rawRows) {
      if (!raw || typeof raw !== 'object') continue;
      const status = String(
        pick(raw as Record<string, unknown>, 'Status', 'status') ?? ''
      ).trim();
      if (status === 'Inactive') skippedInactive += 1;
    }
  }
  const flat = flattenOmniProducts(rawRows, { excludeInactive });
  return {
    rows: flat,
    total,
    sourceRowCount: rawRows.length,
    skippedInactive,
  };
}

export type Cin7OmniContactRow = {
  cin7ContactId: string;
  contactType: string;
  companyName: string;
  email: string;
  phone?: string;
  city?: string;
};

function mapOmniContactRaw(raw: unknown): Cin7OmniContactRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const cin7ContactId = String(pick(c, 'ID', 'id') ?? '').trim();
  if (!cin7ContactId) return null;
  const contactType =
    String(pick(c, 'Type', 'type', 'ContactType', 'contactType') ?? '').trim() || 'Unknown';
  const company = String(
    pick(c, 'Company', 'company', 'Name', 'name', 'FirstName', 'firstName') ?? ''
  ).trim();
  const lastName = String(pick(c, 'LastName', 'lastName') ?? '').trim();
  const displayName =
    [company, lastName].filter(Boolean).join(' ').trim() ||
    company ||
    lastName ||
    'Cin7 contact';
  const email = String(pick(c, 'Email', 'email') ?? '').trim();
  const phone =
    String(pick(c, 'Phone', 'phone', 'Mobile', 'mobile') ?? '').trim() || undefined;
  const city =
    String(
      pick(c, 'DeliveryCity', 'deliveryCity', 'BillingCity', 'billingCity', 'City', 'city') ?? ''
    ).trim() || undefined;
  return {
    cin7ContactId,
    contactType,
    companyName: displayName,
    email,
    phone,
    city,
  };
}

export type Cin7OmniContactSkip = {
  cin7Id?: string;
  label?: string;
  reason: 'missing_cin7_id' | 'wrong_contact_type';
};

function buildOmniContactsPath(page: number, rows: number, whereType?: string): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('rows', String(rows));
  params.set('order', 'id asc');
  if (whereType) {
    params.set('where', `type='${whereType}'`);
  }
  return `/v1/Contacts?${params.toString()}`;
}

export async function fetchOmniContactsPage(
  creds: Cin7OmniCredentials,
  page: number,
  rows: number,
  options?: { allowedTypes?: string[]; whereType?: string }
): Promise<{
  rows: Cin7OmniContactRow[];
  total: number | null;
  sourceRowCount: number;
  skippedWrongType: number;
  skippedMissingId: number;
  skippedRecords: Cin7OmniContactSkip[];
  error?: string;
}> {
  const safeRows = Math.max(1, Math.min(250, rows));
  const whereType = options?.whereType ?? options?.allowedTypes?.[0];
  const { ok, data, error } = await cin7OmniGet<unknown>(
    buildOmniContactsPath(page, safeRows, whereType),
    creds
  );
  if (!ok) {
    return {
      rows: [],
      total: null,
      sourceRowCount: 0,
      skippedWrongType: 0,
      skippedMissingId: 0,
      skippedRecords: [],
      error,
    };
  }
  const { rows: list, total } = parseOmniListEnvelope(data);
  const allowedTypes = whereType
    ? [whereType.toLowerCase()]
    : options?.allowedTypes?.map((t) => t.toLowerCase());
  let skippedWrongType = 0;
  let skippedMissingId = 0;
  const skippedRecords: Cin7OmniContactSkip[] = [];
  const mapped: Cin7OmniContactRow[] = [];

  for (const raw of list) {
    const row = mapOmniContactRaw(raw);
    if (!row) {
      skippedMissingId += 1;
      const label =
        raw && typeof raw === 'object'
          ? String(
              pick(raw as Record<string, unknown>, 'Company', 'company', 'Name', 'name') ?? ''
            ).trim() || undefined
          : undefined;
      skippedRecords.push({ label, reason: 'missing_cin7_id' });
      continue;
    }
    if (
      allowedTypes &&
      allowedTypes.length > 0 &&
      !allowedTypes.includes(row.contactType.toLowerCase())
    ) {
      skippedWrongType += 1;
      skippedRecords.push({
        cin7Id: row.cin7ContactId,
        label: row.companyName,
        reason: 'wrong_contact_type',
      });
      continue;
    }
    mapped.push(row);
  }

  return {
    rows: mapped,
    total,
    sourceRowCount: list.length,
    skippedWrongType,
    skippedMissingId,
    skippedRecords,
  };
}

export type Cin7OmniBranchRow = {
  cin7BranchId: string;
  name: string;
  branchType?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  postCode?: string;
  isActive: boolean;
};

function mapOmniBranchRaw(raw: unknown): Cin7OmniBranchRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const cin7BranchId = String(pick(b, 'ID', 'id') ?? '').trim();
  if (!cin7BranchId) return null;
  const name = String(pick(b, 'Company', 'company') ?? `Branch ${cin7BranchId}`).trim();
  return {
    cin7BranchId,
    name,
    branchType: String(pick(b, 'BranchType', 'branchType') ?? '').trim() || undefined,
    email: String(pick(b, 'Email', 'email') ?? '').trim() || undefined,
    phone: String(pick(b, 'Phone', 'phone') ?? '').trim() || undefined,
    city: String(pick(b, 'City', 'city') ?? '').trim() || undefined,
    state: String(pick(b, 'State', 'state') ?? '').trim() || undefined,
    postCode: String(pick(b, 'PostCode', 'postCode') ?? '').trim() || undefined,
    isActive: pick(b, 'IsActive', 'isActive') !== false,
  };
}

export async function fetchOmniBranchesPage(
  creds: Cin7OmniCredentials,
  page: number,
  rows: number
): Promise<{
  rows: Cin7OmniBranchRow[];
  total: number | null;
  sourceRowCount: number;
  skippedMissingId: number;
  error?: string;
}> {
  const safeRows = Math.max(1, Math.min(250, rows));
  const { ok, data, error } = await cin7OmniGet<unknown>(
    `/v1/Branches?page=${page}&rows=${safeRows}`,
    creds
  );
  if (!ok) {
    return { rows: [], total: null, sourceRowCount: 0, skippedMissingId: 0, error };
  }
  const { rows: list, total } = parseOmniListEnvelope(data);
  let skippedMissingId = 0;
  const mapped: Cin7OmniBranchRow[] = [];
  for (const raw of list) {
    const row = mapOmniBranchRaw(raw);
    if (!row) {
      skippedMissingId += 1;
      continue;
    }
    mapped.push(row);
  }
  return {
    rows: mapped,
    total,
    sourceRowCount: list.length,
    skippedMissingId,
  };
}

/** Best-effort sales order total (uses API Total when present). */
export async function fetchOmniSalesOrderCount(creds: Cin7OmniCredentials): Promise<number> {
  const { ok, data } = await cin7OmniGet<unknown>(`/v1/SalesOrders?page=1&rows=1`, creds);
  if (!ok) return 0;
  const { total, rows } = parseOmniListEnvelope(data);
  if (total != null && total > 0) return total;
  return rows.length;
}
