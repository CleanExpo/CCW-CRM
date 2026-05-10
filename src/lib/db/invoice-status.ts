/**
 * Derive UI/API status from invoice amounts and dates without persisting on read.
 */
export function deriveInvoiceStatus(inv: {
  status: string;
  dueDate: Date;
  total: number;
  amountPaid: number;
}): string {
  const amountDue = Math.max(0, inv.total - inv.amountPaid);
  if (inv.status === 'cancelled') return 'cancelled';
  if (inv.status === 'draft') return 'draft';
  if (amountDue <= 0.005) return 'paid';
  const end = new Date(inv.dueDate);
  end.setHours(23, 59, 59, 999);
  if (amountDue > 0 && Date.now() > end.getTime()) return 'overdue';
  return inv.status;
}
