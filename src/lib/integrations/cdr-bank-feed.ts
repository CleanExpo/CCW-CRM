/**
 * Read-only CDR / Open Banking bank feed connector.
 * Fetches transaction history only — no payments, transfers, or payee initiation.
 *
 * Configure via env:
 * - CDR_PROVIDER=basiq|adatree|cdr
 * - CDR_API_KEY / CDR_API_BASE_URL
 * - CDR_USER_ID (Basiq user id when using Basiq)
 */

export type CdrSyncRow = {
  transaction_date: Date;
  description: string;
  reference: string;
  credit: number | null;
  debit: number | null;
  balance: number | null;
  raw_narration?: string;
  external_feed_id: string;
};

export type CdrSyncResult = {
  rows: CdrSyncRow[];
  provider: string;
  mode: 'live' | 'unconfigured' | 'demo';
  message?: string;
};

function getCdrConfig() {
  return {
    provider: (process.env.CDR_PROVIDER?.trim() || 'cdr').toLowerCase(),
    apiKey: process.env.CDR_API_KEY?.trim() || '',
    apiBase: (process.env.CDR_API_BASE_URL?.trim() || 'https://api.basiq.io').replace(/\/$/, ''),
    userId: process.env.CDR_USER_ID?.trim() || '',
  };
}

function parseBasiqAmount(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function mapBasiqTransaction(raw: Record<string, unknown>, index: number): CdrSyncRow | null {
  const postDate =
    (raw.postDate as string | undefined) ??
    (raw.transactionDate as string | undefined) ??
    (raw.date as string | undefined);
  const parsedDate = postDate ? new Date(postDate) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) return null;

  const amount = parseBasiqAmount(raw.amount);
  if (amount == null) return null;

  const direction = String(raw.direction ?? raw.type ?? '').toLowerCase();
  const isCredit =
    direction.includes('credit') ||
    direction === 'deposit' ||
    (typeof raw.amount === 'number' && raw.amount > 0 && direction !== 'debit');

  const description =
    String(raw.description ?? raw.narrative ?? raw.reference ?? 'Bank transaction').trim() ||
    'Bank transaction';
  const reference = String(raw.reference ?? raw.id ?? '').trim();
  const externalId = String(raw.id ?? `basiq-${index}-${postDate}`);

  return {
    transaction_date: parsedDate,
    description,
    reference,
    credit: isCredit ? amount : null,
    debit: isCredit ? null : amount,
    balance: parseBasiqAmount(raw.balance),
    raw_narration: String(raw.description ?? raw.narrative ?? description),
    external_feed_id: externalId,
  };
}

async function fetchBasiqTransactions(input: {
  accountId: string;
  startDate: string;
  endDate: string;
}): Promise<CdrSyncRow[]> {
  const { apiKey, apiBase, userId } = getCdrConfig();
  if (!apiKey) return [];

  const accountRef = input.accountId;
  const url = userId
    ? `${apiBase}/users/${encodeURIComponent(userId)}/accounts/${encodeURIComponent(accountRef)}/transactions?from=${input.startDate}&to=${input.endDate}`
    : `${apiBase}/accounts/${encodeURIComponent(accountRef)}/transactions?from=${input.startDate}&to=${input.endDate}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'basiq-version': '3.0',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`CDR provider returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const payload = (await res.json()) as { data?: unknown[]; transactions?: unknown[] };
  const list = (payload.data ?? payload.transactions ?? []) as Record<string, unknown>[];
  return list
    .map((row, i) => mapBasiqTransaction(row, i))
    .filter((r): r is CdrSyncRow => r != null);
}

/** Read-only fetch of bank transactions for reconciliation (no write/payment APIs). */
export async function fetchCdrBankTransactions(input: {
  cdrAccountId: string | null;
  accountNumber: string;
  bsb: string;
  startDate: string;
  endDate: string;
}): Promise<CdrSyncResult> {
  const { provider, apiKey } = getCdrConfig();
  const accountRef =
    input.cdrAccountId?.trim() ||
    `${input.bsb.replace(/\D/g, '')}-${input.accountNumber.replace(/\D/g, '')}`;

  if (!apiKey) {
    return {
      rows: [],
      provider,
      mode: 'unconfigured',
      message:
        'CDR read-only sync is not configured. Set CDR_API_KEY (and CDR_USER_ID for Basiq) or import CSV via Bank Feeds.',
    };
  }

  if (process.env.CDR_USE_DEMO === 'true') {
    const today = new Date();
    return {
      rows: [
        {
          transaction_date: today,
          description: 'CDR demo — customer payment',
          reference: `CDR-DEMO-${Date.now()}`,
          credit: 1250.5,
          debit: null,
          balance: null,
          raw_narration: 'Read-only CDR demo credit',
          external_feed_id: `cdr-demo-credit-${today.toISOString().slice(0, 10)}`,
        },
        {
          transaction_date: today,
          description: 'CDR demo — supplier payment',
          reference: `CDR-DEMO-${Date.now()}-2`,
          credit: null,
          debit: 890.25,
          balance: null,
          raw_narration: 'Read-only CDR demo debit',
          external_feed_id: `cdr-demo-debit-${today.toISOString().slice(0, 10)}`,
        },
      ],
      provider,
      mode: 'demo',
      message: 'CDR demo mode — set CDR_USE_DEMO=false for live read-only sync.',
    };
  }

  const rows =
    provider === 'basiq' || provider === 'cdr' || provider === 'adatree'
      ? await fetchBasiqTransactions({
          accountId: accountRef,
          startDate: input.startDate,
          endDate: input.endDate,
        })
      : [];

  return {
    rows,
    provider,
    mode: 'live',
    message:
      rows.length === 0
        ? 'No new transactions returned for the date range (read-only CDR sync).'
        : undefined,
  };
}

export function isCdrFeedProvider(feedProvider: string): boolean {
  return ['cdr', 'basiq', 'adatree', 'open_banking'].includes(feedProvider.toLowerCase());
}
