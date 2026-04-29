import type { NextRequest } from 'next/server';

const DEFAULT_BASE = 'https://inventory.dearsystems.com/ExternalApi/v2';

export function getCin7CoreBaseUrl(): string {
  return process.env.CIN7_CORE_API_BASE_URL?.trim() || DEFAULT_BASE;
}

export function getCin7Mode(): 'demo' | 'live' {
  return process.env.CIN7_MODE === 'demo' ? 'demo' : 'live';
}

export function getCin7CoreCredentials(request?: NextRequest): {
  accountId: string;
  applicationKey: string;
} | null {
  const accountId =
    request?.cookies.get('cin7_core_account_id')?.value?.trim() ||
    process.env.CIN7_CORE_ACCOUNT_ID?.trim() ||
    '';
  const applicationKey =
    request?.cookies.get('cin7_core_application_key')?.value?.trim() ||
    process.env.CIN7_CORE_APPLICATION_KEY?.trim() ||
    '';
  if (!accountId || !applicationKey) return null;
  return { accountId, applicationKey };
}

export async function cin7CoreGet<T>(
  pathWithQuery: string,
  creds: { accountId: string; applicationKey: string }
): Promise<{ ok: boolean; status: number; data: T }> {
  const base = getCin7CoreBaseUrl().replace(/\/$/, '');
  const p = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  const url = `${base}${p}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'api-auth-accountid': creds.accountId,
      'api-auth-applicationkey': creds.applicationKey,
    },
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/** Lightweight ping — valid credentials return 200 with product list envelope. */
export async function pingCin7Core(creds: {
  accountId: string;
  applicationKey: string;
}): Promise<boolean> {
  const { ok, status } = await cin7CoreGet<{ Total?: number }>(
    '/Product?Page=1&Limit=1',
    creds
  );
  return ok && status === 200;
}

export type Cin7ProductRow = {
  ID?: string;
  Sku?: string;
  Name?: string;
  Price?: number;
  SellPrice?: number;
  AverageCost?: number;
  Available?: number;
  [key: string]: unknown;
};

export async function fetchCin7ProductPage(
  creds: { accountId: string; applicationKey: string },
  page: number,
  limit: number
): Promise<{ rows: Cin7ProductRow[]; total: number }> {
  const { ok, data } = await cin7CoreGet<{
    ProductList?: Cin7ProductRow[];
    Total?: number;
  }>(`/Product?Page=${page}&Limit=${limit}`, creds);
  if (!ok) return { rows: [], total: 0 };
  const rows = Array.isArray(data.ProductList) ? data.ProductList : [];
  const total = typeof data.Total === 'number' ? data.Total : rows.length;
  return { rows, total };
}

export type Cin7CustomerRow = {
  Name?: string;
  Email?: string;
  Phone?: string;
  City?: string;
  [key: string]: unknown;
};

export async function fetchCin7CustomerPage(
  creds: { accountId: string; applicationKey: string },
  page: number,
  limit: number
): Promise<{ rows: Cin7CustomerRow[]; total: number }> {
  const { ok, data } = await cin7CoreGet<{
    CustomerList?: Cin7CustomerRow[];
    Total?: number;
  }>(`/Customer?Page=${page}&Limit=${limit}`, creds);
  if (!ok) return { rows: [], total: 0 };
  const rows = Array.isArray(data.CustomerList) ? data.CustomerList : [];
  const total = typeof data.Total === 'number' ? data.Total : rows.length;
  return { rows, total };
}

export async function fetchCin7SaleTotal(
  creds: { accountId: string; applicationKey: string }
): Promise<number> {
  const { ok, data } = await cin7CoreGet<{ Total?: number }>(`/Sale?Page=1&Limit=1`, creds);
  if (!ok) return 0;
  return typeof data.Total === 'number' ? data.Total : 0;
}
