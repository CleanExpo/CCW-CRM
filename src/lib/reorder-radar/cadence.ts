/**
 * UNI-2749: reorder radar. Plain statistics over posted invoice lines, no AI.
 *
 * One pure function turns purchase lines into the daily call list, so the list
 * the screen shows can be rebuilt from the reporting extract for the same as-of
 * date (see radarLinesFromExtract).
 */
import type { ExtractInvoiceLine } from '@/lib/reporting/transaction-extract';

export type PurchaseLine = {
  customerId: string;
  productId: string;
  /** Invoice date, YYYY-MM-DD. */
  date: string;
  quantity: number;
};

/** Invoice statuses that are not a real purchase. */
export const NON_SALE_STATUSES = new Set(['draft', 'cancelled', 'void', 'voided']);

export const RADAR_DEFAULTS = {
  /** Purchase days needed before a cadence is trusted (two gaps). */
  minPurchases: 3,
  /** Show as "due" this many days before the expected reorder date. */
  leadDays: 7,
  /** Past expected by more than max(graceDays, 25% of cadence) = overdue. */
  graceDays: 7,
  /**
   * Past expected by more than this many cadences = dropped from overdue, but only when the
   * customer is still buying other things (this product lapsed) or has been handed to gone
   * quiet. A customer who has bought nothing since stays overdue until gone quiet takes over.
   */
  staleCadences: 3,
  /** Customer is "gone quiet" when silent for this many of their usual gaps... */
  quietCadences: 2,
  /** ...and at least this many days. */
  quietMinDays: 45,
};

export type RadarOptions = typeof RADAR_DEFAULTS;

export type CadenceRow = {
  customerId: string;
  productId: string;
  purchases: number;
  cadenceDays: number;
  avgQuantity: number;
  lastDate: string;
  expectedDate: string;
  /** Negative = days until expected; positive = days late. */
  daysLate: number;
};

export type QuietRow = {
  customerId: string;
  purchases: number;
  cadenceDays: number;
  lastDate: string;
  daysSilent: number;
};

export type Radar = {
  asOf: string;
  due: CadenceRow[];
  overdue: CadenceRow[];
  goneQuiet: QuietRow[];
  /** Every trusted cadence, for demand forecasting. */
  cadences: CadenceRow[];
};

const DAY = 86_400_000;

function toDay(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);
}

function fromDay(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Distinct purchase days, sorted, plus total quantity per day. */
function purchaseDays(lines: PurchaseLine[]): { days: number[]; qtyByDay: Map<number, number> } {
  const qtyByDay = new Map<number, number>();
  for (const l of lines) {
    const d = toDay(l.date);
    qtyByDay.set(d, (qtyByDay.get(d) ?? 0) + l.quantity);
  }
  return { days: [...qtyByDay.keys()].sort((a, b) => a - b), qtyByDay };
}

function gaps(days: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < days.length; i++) out.push(days[i] - days[i - 1]);
  return out;
}

export function buildRadar(
  lines: PurchaseLine[],
  asOf: string,
  opts: Partial<RadarOptions> = {}
): Radar {
  const o = { ...RADAR_DEFAULTS, ...opts };
  const today = toDay(asOf);
  const visible = lines.filter((l) => toDay(l.date) <= today && l.quantity > 0);

  const byPair = new Map<string, PurchaseLine[]>();
  const byCustomer = new Map<string, PurchaseLine[]>();
  for (const l of visible) {
    const k = `${l.customerId}\u0000${l.productId}`;
    byPair.set(k, [...(byPair.get(k) ?? []), l]);
    byCustomer.set(l.customerId, [...(byCustomer.get(l.customerId) ?? []), l]);
  }

  const cadences: CadenceRow[] = [];
  for (const group of byPair.values()) {
    const { days, qtyByDay } = purchaseDays(group);
    if (days.length < o.minPurchases) continue;
    const cadenceDays = median(gaps(days));
    if (cadenceDays <= 0) continue;
    const last = days[days.length - 1];
    const expected = last + Math.round(cadenceDays);
    const totalQty = days.reduce((s, d) => s + (qtyByDay.get(d) ?? 0), 0);
    cadences.push({
      customerId: group[0].customerId,
      productId: group[0].productId,
      purchases: days.length,
      cadenceDays,
      avgQuantity: totalQty / days.length,
      lastDate: fromDay(last),
      expectedDate: fromDay(expected),
      daysLate: today - expected,
    });
  }

  const goneQuiet: QuietRow[] = [];
  for (const [customerId, group] of byCustomer) {
    const { days } = purchaseDays(group);
    if (days.length < o.minPurchases) continue;
    const cadenceDays = median(gaps(days));
    const last = days[days.length - 1];
    const daysSilent = today - last;
    if (daysSilent >= Math.max(o.quietMinDays, cadenceDays * o.quietCadences)) {
      goneQuiet.push({
        customerId,
        purchases: days.length,
        cadenceDays,
        lastDate: fromDay(last),
        daysSilent,
      });
    }
  }

  // Last purchase day per customer, across every product.
  const customerLast = new Map<string, number>();
  for (const [customerId, group] of byCustomer) {
    customerLast.set(customerId, Math.max(...group.map((l) => toDay(l.date))));
  }
  const quietIds = new Set(goneQuiet.map((q) => q.customerId));

  const due: CadenceRow[] = [];
  const overdue: CadenceRow[] = [];
  for (const c of cadences) {
    const grace = Math.max(o.graceDays, Math.round(c.cadenceDays * 0.25));
    const stale = c.daysLate > c.cadenceDays * o.staleCadences;
    // Silent since this product's last purchase: nothing else bought afterwards.
    const silentSince = (customerLast.get(c.customerId) ?? 0) <= toDay(c.lastDate);
    if (c.daysLate >= -o.leadDays && c.daysLate <= grace) due.push(c);
    else if (c.daysLate > grace && (!stale || (silentSince && !quietIds.has(c.customerId)))) {
      overdue.push(c);
    }
  }

  const byKey = (a: CadenceRow, b: CadenceRow) =>
    b.daysLate - a.daysLate ||
    a.customerId.localeCompare(b.customerId) ||
    a.productId.localeCompare(b.productId);
  due.sort(byKey);
  overdue.sort(byKey);
  goneQuiet.sort((a, b) => b.daysSilent - a.daysSilent || a.customerId.localeCompare(b.customerId));
  cadences.sort(byKey);
  return { asOf, due, overdue, goneQuiet, cadences };
}

/**
 * Rebuilds radar input from the reporting extract, applying the same rules as
 * the live read: posted invoices only, lines with a product only.
 */
export function radarLinesFromExtract(lines: ExtractInvoiceLine[]): PurchaseLine[] {
  return lines
    .filter((l) => l.product_id && !NON_SALE_STATUSES.has(l.invoice_status ?? ''))
    .map((l) => ({
      customerId: l.customer_id,
      productId: l.product_id as string,
      date: l.invoice_date,
      quantity: l.quantity,
    }));
}

/** Units per day a product is expected to sell, summed over trusted cadences. */
export function dailyDemandByProduct(cadences: CadenceRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of cadences) {
    out.set(c.productId, (out.get(c.productId) ?? 0) + c.avgQuantity / c.cadenceDays);
  }
  return out;
}
