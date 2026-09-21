/**
 * UNI-2751 Price Mole: competitor matches, capture runs and price reads.
 *
 * Capture only fetches public pages, checks robots.txt first, stops at the
 * run's page budget, and never writes a price it could not read. The network
 * call is injectable so tests never touch a real site.
 */
import type { CompetitorPrice, CompetitorProduct, Product } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  extractPrice,
  marginAtMatch,
  presentPrice,
  robotsAllows,
  USER_AGENT,
  type PresentedPrice,
} from '@/lib/price-mole/rules';
import { createSafeFetch } from '@/lib/price-mole/safe-fetch';

export type Fetcher = (url: string) => Promise<{ status: number; text: string }>;

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_CHARS = 3_000_000;
/** A page is not fetched again within this many hours. */
export const MIN_HOURS_BETWEEN_ATTEMPTS = 20;
/** Hard ceiling on pages per run, whatever the caller asks for. */
export const MAX_PAGE_BUDGET = 200;
export const DEFAULT_PAGE_BUDGET = 50;

/** Every hop (including redirects and robots.txt) must resolve to a public address. */
export const defaultFetcher: Fetcher = createSafeFetch({
  headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain' },
  timeoutMs: FETCH_TIMEOUT_MS,
  maxBodyChars: MAX_BODY_CHARS,
});

/** A usable page budget: finite, at least 1, never above the ceiling. Anything else gets the default. */
export function clampPageBudget(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PAGE_BUDGET;
  return Math.min(Math.max(Math.floor(n), 1), MAX_PAGE_BUDGET);
}

export class PriceMoleInputError extends Error {}

function publicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new PriceMoleInputError('Not a valid URL');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new PriceMoleInputError('Only http and https pages can be tracked');
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^(\d+\.){3}\d+$/.test(host) ||
    host.includes(':')
  ) {
    throw new PriceMoleInputError('Only public website addresses can be tracked');
  }
  return u;
}

type CpWithPrices = CompetitorProduct & { prices: CompetitorPrice[]; product: Product | null };

export function competitorToApi(row: CpWithPrices, now: Date) {
  const latest = row.prices[0];
  return {
    id: row.id,
    competitor: row.competitor,
    url: row.url,
    title: row.title,
    competitor_sku: row.competitorSku,
    match_status: row.matchStatus,
    is_active: row.isActive,
    last_attempt_at: row.lastAttemptAt,
    last_error: row.lastError,
    product: row.product
      ? {
          id: row.product.id,
          name: row.product.name,
          sku: row.product.sku,
          price: row.product.price,
        }
      : null,
    latest_price: latest ? presentPrice(latest, now) : null,
    history: row.prices.map((p) => presentPrice(p, now)),
  };
}

export async function listCompetitorProducts(workspaceUserIds: string[], productId?: string) {
  return prisma.competitorProduct.findMany({
    where: { ownerUserId: { in: workspaceUserIds }, ...(productId ? { productId } : {}) },
    include: { prices: { orderBy: { capturedAt: 'desc' }, take: 20 }, product: true },
    orderBy: [{ competitor: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function createCompetitorProduct(
  workspaceUserIds: string[],
  actorUserId: string,
  input: {
    competitor: string;
    url: string;
    productSku?: string | null;
    competitorSku?: string | null;
  }
) {
  const competitor = input.competitor.trim();
  if (!competitor) throw new PriceMoleInputError('Competitor name is required');
  const url = publicHttpUrl(input.url.trim()).toString();
  let productId: string | null = null;
  if (input.productSku) {
    const matches = await prisma.product.findMany({
      where: { ownerUserId: { in: workspaceUserIds }, sku: input.productSku.trim() },
      select: { id: true },
    });
    if (matches.length !== 1) {
      throw new PriceMoleInputError(
        matches.length === 0
          ? `No CCW product with SKU ${input.productSku}`
          : `SKU ${input.productSku} matches ${matches.length} products`
      );
    }
    productId = matches[0].id;
  }
  return prisma.competitorProduct.create({
    data: {
      ownerUserId: actorUserId,
      competitor,
      url,
      competitorSku: input.competitorSku?.trim() || null,
      productId,
      matchStatus: 'suggested',
    },
  });
}

export async function reviewMatch(
  workspaceUserIds: string[],
  actorUserId: string,
  id: string,
  status: string
) {
  if (!['confirmed', 'rejected', 'suggested'].includes(status)) {
    throw new PriceMoleInputError('Invalid status');
  }
  const row = await prisma.competitorProduct.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!row) return null;
  if (status === 'confirmed' && !row.productId) {
    throw new PriceMoleInputError('Link a CCW product before confirming the match');
  }
  return prisma.competitorProduct.update({
    where: { id },
    data: {
      matchStatus: status,
      confirmedBy: status === 'confirmed' ? actorUserId : null,
      confirmedAt: status === 'confirmed' ? new Date() : null,
    },
  });
}

/** Staff type in a price they saw (phone, catalogue). Recorded as manual, dated now. */
export async function recordManualPrice(workspaceUserIds: string[], id: string, price: number) {
  if (!Number.isFinite(price) || price <= 0)
    throw new PriceMoleInputError('Price must be positive');
  const row = await prisma.competitorProduct.findFirst({
    where: { id, ownerUserId: { in: workspaceUserIds } },
  });
  if (!row) return null;
  return prisma.competitorPrice.create({
    data: { competitorProductId: id, price, source: 'manual', capturedAt: new Date() },
  });
}

export type CaptureOutcome = {
  id: string;
  url: string;
  ok: boolean;
  price?: number;
  error?: string;
  skipped?: string;
};

/**
 * One budgeted capture run over the workspace's active, non-rejected matches.
 * Each page fetch counts against the budget (robots.txt fetches do not, and are
 * cached per site for the run). Stops hard when the budget is spent.
 */
export async function runCapture(
  workspaceUserIds: string[],
  actorUserId: string,
  opts: {
    trigger: 'manual' | 'cron';
    pageBudget?: number;
    fetcher?: Fetcher;
    now?: Date;
    onlyId?: string;
  }
) {
  const fetcher = opts.fetcher ?? defaultFetcher;
  const now = opts.now ?? new Date();
  const budget = clampPageBudget(opts.pageBudget);
  const run = await prisma.competitorCaptureRun.create({
    data: { ownerUserId: actorUserId, trigger: opts.trigger, pageBudget: budget, startedAt: now },
  });

  const targets = await prisma.competitorProduct.findMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      isActive: true,
      matchStatus: { not: 'rejected' },
      ...(opts.onlyId ? { id: opts.onlyId } : {}),
    },
    orderBy: { lastAttemptAt: { sort: 'asc', nulls: 'first' } },
  });

  const robotsCache = new Map<string, string | null>();
  const outcomes: CaptureOutcome[] = [];
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let stoppedReason: string | null = null;

  for (const t of targets) {
    if (
      t.lastAttemptAt &&
      now.getTime() - t.lastAttemptAt.getTime() < MIN_HOURS_BETWEEN_ATTEMPTS * 3_600_000
    ) {
      skipped++;
      outcomes.push({ id: t.id, url: t.url, ok: false, skipped: 'checked recently' });
      continue;
    }
    if (attempted >= budget) {
      stoppedReason = `page budget of ${budget} reached`;
      break;
    }
    const u = new URL(t.url);
    const origin = u.origin;
    if (!robotsCache.has(origin)) {
      try {
        const r = await fetcher(`${origin}/robots.txt`);
        // 4xx = no robots file = allowed. 5xx or network error = unknown = do not fetch.
        robotsCache.set(origin, r.status >= 500 ? null : r.status >= 400 ? '' : r.text);
      } catch {
        robotsCache.set(origin, null);
      }
    }
    const robots = robotsCache.get(origin);
    if (robots === null || robots === undefined || !robotsAllows(robots, u.pathname + u.search)) {
      const error =
        robots === null || robots === undefined
          ? 'robots.txt could not be read, so the page was not fetched'
          : 'robots.txt does not allow this page, so it was not fetched';
      skipped++;
      outcomes.push({ id: t.id, url: t.url, ok: false, skipped: error });
      await prisma.competitorProduct.update({
        where: { id: t.id },
        data: { lastAttemptAt: now, lastError: error },
      });
      continue;
    }

    attempted++;
    try {
      const page = await fetcher(t.url);
      if (page.status >= 400) throw new Error(`Page returned HTTP ${page.status}`);
      const got = extractPrice(page.text);
      await prisma.competitorPrice.create({
        data: {
          competitorProductId: t.id,
          price: got.price,
          currency: got.currency,
          source: 'capture',
          capturedAt: now,
        },
      });
      await prisma.competitorProduct.update({
        where: { id: t.id },
        data: { lastAttemptAt: now, lastError: null, ...(t.title ? {} : { title: got.title }) },
      });
      succeeded++;
      outcomes.push({ id: t.id, url: t.url, ok: true, price: got.price });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await prisma.competitorProduct.update({
        where: { id: t.id },
        data: { lastAttemptAt: now, lastError: error },
      });
      failed++;
      outcomes.push({ id: t.id, url: t.url, ok: false, error });
    }
  }

  const finished = await prisma.competitorCaptureRun.update({
    where: { id: run.id },
    data: { attempted, succeeded, failed, skipped, stoppedReason, finishedAt: new Date() },
  });
  return { run: finished, outcomes };
}

/**
 * What the quote builder shows next to a CCW product: confirmed matches only,
 * each with its dated latest price and the margin CCW keeps if it matches it.
 */
export async function getQuoteComparison(
  workspaceUserIds: string[],
  by: { skus?: string[]; productIds?: string[] },
  now = new Date()
) {
  const products = await prisma.product.findMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      OR: [{ sku: { in: by.skus ?? [] } }, { id: { in: by.productIds ?? [] } }],
    },
    select: { id: true, name: true, sku: true, price: true },
  });
  const ids = products.map((p) => p.id);
  const [matches, costs] = await Promise.all([
    prisma.competitorProduct.findMany({
      where: {
        ownerUserId: { in: workspaceUserIds },
        productId: { in: ids },
        matchStatus: 'confirmed',
        isActive: true,
      },
      include: { prices: { orderBy: { capturedAt: 'desc' }, take: 1 } },
    }),
    prisma.purchaseOrderLine.findMany({
      where: { productId: { in: ids }, purchaseOrder: { ownerUserId: { in: workspaceUserIds } } },
      select: { productId: true, unitCost: true, purchaseOrder: { select: { orderDate: true } } },
      orderBy: { purchaseOrder: { orderDate: 'desc' } },
    }),
  ]);
  const latestCost = new Map<string, number>();
  for (const c of costs)
    if (c.productId && !latestCost.has(c.productId)) latestCost.set(c.productId, c.unitCost);

  return products.map((p) => {
    const cost = latestCost.get(p.id) ?? null;
    return {
      product: p,
      unit_cost: cost,
      ccw_margin: marginAtMatch(p.price, cost),
      competitors: matches
        .filter((m) => m.productId === p.id)
        .map((m) => {
          const latest: PresentedPrice | null = m.prices[0] ? presentPrice(m.prices[0], now) : null;
          return {
            id: m.id,
            competitor: m.competitor,
            url: m.url,
            title: m.title,
            latest_price: latest,
            last_error: m.lastError,
            margin_at_match: latest ? marginAtMatch(latest.price, cost) : null,
          };
        }),
    };
  });
}
