import {
  delayForRetry,
  isRetryableHttpStatus,
  sleepForRetry,
  type Cin7HttpRetryResult,
} from '@/lib/integrations/cin7-http-retry';
import type { NextRequest } from 'next/server';

const DEFAULT_BASE = 'https://inventory.dearsystems.com/ExternalApi/v2';
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_RETRIES = 2;

type Cin7HttpResult<T> = Cin7HttpRetryResult<T>;

export function getCin7CoreBaseUrl(): string {
  return process.env.CIN7_CORE_API_BASE_URL?.trim() || DEFAULT_BASE;
}

export function getCin7Mode(): 'demo' | 'live' {
  return process.env.CIN7_MODE === 'demo' ? 'demo' : 'live';
}

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
  creds: { accountId: string; applicationKey: string },
  options?: { retries?: number }
): Promise<Cin7HttpResult<T>> {
  const base = getCin7CoreBaseUrl().replace(/\/$/, '');
  const p = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  const url = `${base}${p}`;
  const retries = options?.retries ?? getCin7RequestRetries();
  let lastRetryAfterMs: number | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getCin7RequestTimeoutMs());
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'api-auth-accountid': creds.accountId,
          'api-auth-applicationkey': creds.applicationKey,
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as T;
      clearTimeout(timeout);
      if (isRetryableHttpStatus(res.status) && attempt < retries) {
        const waitMs = delayForRetry({
          status: res.status,
          attempt,
          retryAfterHeader: res.headers.get('retry-after'),
        });
        lastRetryAfterMs = waitMs;
        await sleepForRetry(waitMs);
        continue;
      }
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: res.ok ? undefined : `Cin7 Core HTTP ${res.status}`,
        retryAfterMs: res.status === 429 ? lastRetryAfterMs : undefined,
      };
    } catch (error) {
      clearTimeout(timeout);
      const message = getErrorMessage(error);
      if (attempt < retries) {
        const waitMs = delayForRetry({
          status: 503,
          attempt,
          retryAfterHeader: null,
        });
        await sleepForRetry(waitMs);
        continue;
      }
      return {
        ok: false,
        status: 504,
        data: {} as T,
        error: `Cin7 Core request failed: ${message}`,
      };
    }
  }

  return {
    ok: false,
    status: 504,
    data: {} as T,
    error: 'Cin7 Core request failed after retries.',
    retryAfterMs: lastRetryAfterMs,
  };
}

/** Lightweight ping — valid credentials return 200 with product list envelope. */
export async function pingCin7Core(creds: {
  accountId: string;
  applicationKey: string;
}): Promise<boolean> {
  const { ok, status } = await cin7CoreGet<{ Total?: number }>('/Product?Page=1&Limit=1', creds, {
    retries: 0,
  });
  // Rate-limited but authenticated — treat as reachable.
  if (status === 429) return true;
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
): Promise<{ rows: Cin7ProductRow[]; total: number; error?: string }> {
  const { ok, data, error } = await cin7CoreGet<{
    ProductList?: Cin7ProductRow[];
    Total?: number;
  }>(`/Product?Page=${page}&Limit=${limit}`, creds);
  if (!ok) return { rows: [], total: 0, error };
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
): Promise<{ rows: Cin7CustomerRow[]; total: number; error?: string }> {
  const { ok, data, error } = await cin7CoreGet<{
    CustomerList?: Cin7CustomerRow[];
    Total?: number;
  }>(`/Customer?Page=${page}&Limit=${limit}`, creds);
  if (!ok) return { rows: [], total: 0, error };
  const rows = Array.isArray(data.CustomerList) ? data.CustomerList : [];
  const total = typeof data.Total === 'number' ? data.Total : rows.length;
  return { rows, total };
}

export async function fetchCin7SaleTotal(creds: {
  accountId: string;
  applicationKey: string;
}): Promise<number> {
  const { ok, data } = await cin7CoreGet<{ Total?: number }>(`/Sale?Page=1&Limit=1`, creds);
  if (!ok) return 0;
  return typeof data.Total === 'number' ? data.Total : 0;
}
