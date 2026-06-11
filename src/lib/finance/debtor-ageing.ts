/**
 * Debtor ageing calculation library.
 *
 * Key concepts:
 *  - "Outstanding" = invoice.total - sum(payments) — uses the DB fields, not re-derived.
 *  - Due date is either the Invoice.dueDate stored on the row (which may already be
 *    correctly computed at invoice creation) OR re-derived from creditTermsType if the
 *    customer's terms override the stored value.  For the ageing report we always use the
 *    STORED dueDate (source of truth) — customers can override their terms without
 *    retroactively shifting all past invoices.
 *  - Ageing buckets (calendar days past due at `asOf` date):
 *      Current   = dueDate >= asOf (not yet due)
 *      1–30      = 1..30 days past due
 *      31–60     = 31..60 days past due
 *      61–90     = 61..90 days past due
 *      90+       = > 90 days past due
 *
 * NOTE on TASK-2 seam: PROJECT-STATUS.md flags that the invoice data layer may return
 * empty arrays in some call paths. This library computes directly from the Prisma row
 * shape passed in — callers should pass raw Prisma includes, not api-serialised data.
 */

export type CreditTermsType = 'NET' | 'EOM';

/**
 * Compute the effective due date from invoice metadata when we want to RE-DERIVE it
 * (e.g., for newly-created invoices). For ageing, we use the stored Invoice.dueDate.
 *
 * NET: due = invoiceDate + creditTermsDays
 * EOM: due = end-of-invoice-month + creditTermsDays
 */
export function computeDueDate(invoiceDate: Date, terms: CreditTermsType, days: number): Date {
  if (terms === 'NET') {
    const d = new Date(invoiceDate);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }
  // EOM: last day of the invoice month, then +days
  const d = new Date(Date.UTC(invoiceDate.getUTCFullYear(), invoiceDate.getUTCMonth() + 1, 0));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export type AgeingBuckets = {
  current: number;
  '1-30': number;
  '31-60': number;
  '61-90': number;
  '90+': number;
  total: number;
};

/** Days past due (negative = not yet due / current). */
function daysPastDue(dueDate: Date, asOf: Date): number {
  const msPerDay = 86_400_000;
  // Normalise both to midnight UTC to avoid DST artefacts
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const ref = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return Math.floor((ref - due) / msPerDay);
}

export function bucketForDaysPastDue(days: number): AgingBucket {
  if (days <= 0) return 'current';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export type InvoiceForAgeing = {
  id: string;
  dueDate: Date;
  total: number;
  amountPaid: number;
};

/**
 * Compute ageing buckets for a list of outstanding invoices.
 * Only invoices with outstanding > 0 (i.e., not fully paid, not cancelled) are included.
 * Callers should filter out cancelled / voided invoices before passing.
 */
export function computeAgeingBuckets(invoices: InvoiceForAgeing[], asOf: Date): AgeingBuckets {
  const buckets: AgeingBuckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };

  for (const inv of invoices) {
    const outstanding = inv.total - inv.amountPaid;
    if (outstanding <= 0) continue;

    const days = daysPastDue(inv.dueDate, asOf);
    const bucket = bucketForDaysPastDue(days);
    buckets[bucket] += outstanding;
    buckets.total += outstanding;
  }

  // Round to 2dp to avoid floating-point drift in display
  for (const key of Object.keys(buckets) as (keyof AgeingBuckets)[]) {
    buckets[key] = Math.round(buckets[key] * 100) / 100;
  }

  return buckets;
}

export type CustomerAgeingRow = {
  customerId: string;
  companyName: string;
  email: string | null;
  creditLimitAUD: number | null;
  buckets: AgeingBuckets;
};

export type InvoiceForAgeingWithCustomer = InvoiceForAgeing & {
  customerId: string;
  companyName: string;
  email: string | null;
  creditLimitAUD: number | null;
};

/**
 * Group a flat list of invoices (with customer data embedded) into per-customer ageing rows.
 */
export function buildCustomerAgeingLedger(
  invoices: InvoiceForAgeingWithCustomer[],
  asOf: Date
): CustomerAgeingRow[] {
  // Group by customerId
  const byCustomer = new Map<string, InvoiceForAgeingWithCustomer[]>();
  for (const inv of invoices) {
    const group = byCustomer.get(inv.customerId) ?? [];
    group.push(inv);
    byCustomer.set(inv.customerId, group);
  }

  const rows: CustomerAgeingRow[] = [];
  for (const [customerId, custInvoices] of byCustomer) {
    const first = custInvoices[0];
    rows.push({
      customerId,
      companyName: first.companyName,
      email: first.email,
      creditLimitAUD: first.creditLimitAUD,
      buckets: computeAgeingBuckets(custInvoices, asOf),
    });
  }

  // Sort by total outstanding descending (worst debtor first)
  rows.sort((a, b) => b.buckets.total - a.buckets.total);

  return rows;
}
