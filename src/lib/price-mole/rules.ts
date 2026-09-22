/**
 * UNI-2751 Price Mole: pure rules. No network and no database here.
 */

export class PriceNotFoundError extends Error {
  constructor(message = 'No price found on the page. The page layout may have changed.') {
    super(message);
  }
}

export type ExtractedPrice = { price: number; currency: string; title: string | null; via: string };

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    return v.trim() !== '' && Number.isFinite(n) && /\d/.test(v) ? n : null;
  }
  return null;
}

function* walk(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
  } else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    yield o;
    if (o['@graph']) yield* walk(o['@graph']);
  }
}

function isType(o: Record<string, unknown>, t: string): boolean {
  const v = o['@type'];
  return v === t || (Array.isArray(v) && v.includes(t));
}

function offerPrice(offers: unknown): { price: number; currency: string } | null {
  for (const o of walk(offers)) {
    const price = toNumber(o.price) ?? toNumber(o.lowPrice);
    if (price !== null && price > 0) {
      return { price, currency: typeof o.priceCurrency === 'string' ? o.priceCurrency : 'AUD' };
    }
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Reads the price a page publishes for machines (schema.org Product JSON-LD,
 * then the product:price:amount meta tag). Throws PriceNotFoundError rather
 * than guessing from visible text, so a redesigned page fails loudly.
 */
export function extractPrice(html: string): ExtractedPrice {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const m of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const o of walk(data)) {
      if (!isType(o, 'Product')) continue;
      const p = offerPrice(o.offers);
      if (p) {
        return { ...p, title: typeof o.name === 'string' ? o.name : null, via: 'json-ld' };
      }
    }
  }
  const meta =
    html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:amount["']/i);
  const metaPrice = meta ? toNumber(decodeEntities(meta[1])) : null;
  if (metaPrice !== null && metaPrice > 0) {
    const cur = html.match(
      /<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([^"']+)["']/i
    );
    const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    return {
      price: metaPrice,
      currency: cur ? cur[1] : 'AUD',
      title: title ? decodeEntities(title[1]) : null,
      via: 'meta',
    };
  }
  throw new PriceNotFoundError();
}

// ─── robots.txt ──────────────────────────────────────────────────────────────

export const USER_AGENT = 'CCW-Optix-PriceMole/1.0';

/**
 * Standard longest-match robots.txt check for our agent, falling back to the
 * `*` group. Allow wins a tie. An unreadable robots file is treated by the
 * caller, not here.
 */
export function robotsAllows(robotsTxt: string, path: string, agent = USER_AGENT): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      // Keep only the product token ("name/1.0" -> "name"). An empty value names no
      // one; storing '' would match every agent through a substring test.
      const token = val.toLowerCase().split('/')[0].trim();
      if (token) cur.agents.push(token);
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      lastWasAgent = false;
      if (key === 'disallow' && val === '') continue;
      cur.rules.push({ allow: key === 'allow', path: val });
    } else {
      lastWasAgent = false;
    }
  }
  const name = agent.toLowerCase().split('/')[0];
  // Our group is one that names our product token exactly; otherwise `*` applies.
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && a === name));
  const chosen = mine.length > 0 ? mine : groups.filter((g) => g.agents.includes('*'));
  let best: { allow: boolean; len: number } | null = null;
  for (const g of chosen) {
    for (const r of g.rules) {
      const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      const anchored = pattern.endsWith('\\$') ? pattern.slice(0, -2) + '$' : pattern;
      if (new RegExp(`^${anchored}`).test(path)) {
        const len = r.path.length;
        if (!best || len > best.len || (len === best.len && r.allow))
          best = { allow: r.allow, len };
      }
    }
  }
  return best ? best.allow : true;
}

// ─── Freshness ───────────────────────────────────────────────────────────────

export const FRESHNESS_DAYS = 7;

export type PresentedPrice = {
  price: number;
  currency: string;
  captured_at: string;
  age_days: number;
  stale: boolean;
  source: string;
};

/**
 * The only way a stored price leaves the server: always with its capture date,
 * and flagged stale once it is older than the freshness window.
 */
export function presentPrice(
  row: { price: number; currency: string; capturedAt: Date; source: string },
  now: Date,
  windowDays = FRESHNESS_DAYS
): PresentedPrice {
  const ageDays = Math.floor((now.getTime() - row.capturedAt.getTime()) / 86_400_000);
  return {
    price: row.price,
    currency: row.currency,
    captured_at: row.capturedAt.toISOString(),
    age_days: ageDays,
    stale: ageDays > windowDays,
    source: row.source,
  };
}

/** Margin CCW would keep if it matched the competitor's price, from the latest known cost. */
export function marginAtMatch(competitorPrice: number, unitCost: number | null): number | null {
  if (unitCost === null || competitorPrice <= 0) return null;
  return Math.round(((competitorPrice - unitCost) / competitorPrice) * 1000) / 10;
}
