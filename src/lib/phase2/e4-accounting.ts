function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
  }
  return undefined;
}

export type CogsEligibility =
  | 'ok'
  | 'no_fully_dispatched_date'
  | 'not_fully_moved'
  | 'no_invoice_date'
  | 'no_accounting_status';

/**
 * Schedule A E4: COGS only when dispatched + dates + accounting status are set.
 * Reads Omni / Core sale JSON as it arrives — we do not invent a status.
 */
export function classifyCogsEligibility(sale: Record<string, unknown>): CogsEligibility {
  const dispatched = pick(
    sale,
    'FullyDispatchedDate',
    'fullyDispatchedDate',
    'DispatchDate',
    'dispatchDate'
  );
  const moved = pick(sale, 'FullyMovedDate', 'fullyMovedDate', 'CompletedDate', 'completedDate');
  const invoiceDate = pick(
    sale,
    'InvoiceDate',
    'invoiceDate',
    'CombinedInvoiceDate',
    'combinedInvoiceDate'
  );
  const accounting = pick(
    sale,
    'AccountingStatus',
    'accountingStatus',
    'CombinedAccountingStatus',
    'combinedAccountingStatus'
  );

  if (dispatched == null || String(dispatched).trim() === '') return 'no_fully_dispatched_date';
  if (moved != null && String(moved).trim() === '') return 'not_fully_moved';
  if (invoiceDate == null || String(invoiceDate).trim() === '') return 'no_invoice_date';
  if (accounting == null || String(accounting).trim() === '') return 'no_accounting_status';
  const status = String(accounting).toLowerCase();
  if (status === 'pending' || status === 'none' || status === 'not posted') {
    return 'no_accounting_status';
  }
  return 'ok';
}

export function tallyCogsEligibility(sales: Array<Record<string, unknown>>): {
  ok: number;
  no_fully_dispatched_date: number;
  not_fully_moved: number;
  no_invoice_date: number;
  no_accounting_status: number;
} {
  const tally = {
    ok: 0,
    no_fully_dispatched_date: 0,
    not_fully_moved: 0,
    no_invoice_date: 0,
    no_accounting_status: 0,
  };
  for (const sale of sales) {
    tally[classifyCogsEligibility(sale)] += 1;
  }
  return tally;
}
