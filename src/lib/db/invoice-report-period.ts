/** Parse `yyyy-MM` or `yyyy-Qn` period strings used by BAS and reports. */
export function parseInvoiceReportPeriod(period: string | null): { start: Date; end: Date } | null {
  if (!period) return null;
  const t = period.trim();
  const q = /^(\d{4})-Q([1-4])$/.exec(t);
  if (q) {
    const y = parseInt(q[1], 10);
    const qi = parseInt(q[2], 10);
    const m0 = (qi - 1) * 3;
    const start = new Date(y, m0, 1);
    const end = new Date(y, m0 + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }
  const mo = /^(\d{4})-(\d{2})$/.exec(t);
  if (mo) {
    const y = parseInt(mo[1], 10);
    const m = parseInt(mo[2], 10) - 1;
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

export function parseDateQuery(value: string | null): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
