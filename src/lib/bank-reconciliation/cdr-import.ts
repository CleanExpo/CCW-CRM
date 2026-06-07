export type CdrImportRow = {
  transaction_date: string;
  description: string;
  reference?: string;
  credit?: number | null;
  debit?: number | null;
  balance?: number | null;
  raw_narration?: string;
  external_feed_id?: string;
};

function parseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmount(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

/** Parse CBA/CDR-style CSV export into normalized feed rows. */
export function parseCdrCsv(content: string): CdrImportRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));

  const dateIdx = idx(['date', 'transaction date', 'posting date']);
  const descIdx = idx(['description', 'narration', 'details']);
  const refIdx = idx(['reference', 'ref']);
  const creditIdx = idx(['credit', 'deposit']);
  const debitIdx = idx(['debit', 'withdrawal', 'payment']);
  const balanceIdx = idx(['balance', 'running balance']);

  const rows: CdrImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.every((c) => !c)) continue;

    const dateRaw = dateIdx >= 0 ? cols[dateIdx] : cols[0];
    const parsedDate = parseDate(dateRaw);
    if (!parsedDate) continue;

    const description = descIdx >= 0 ? cols[descIdx] : cols[1] ?? 'Bank transaction';
    const reference = refIdx >= 0 ? cols[refIdx] : '';
    const credit = creditIdx >= 0 ? parseAmount(cols[creditIdx]) : null;
    const debit = debitIdx >= 0 ? parseAmount(cols[debitIdx]) : null;
    const balance = balanceIdx >= 0 ? parseAmount(cols[balanceIdx]) : null;

    rows.push({
      transaction_date: parsedDate.toISOString(),
      description: description || 'Bank transaction',
      reference: reference ?? '',
      credit,
      debit,
      balance,
      raw_narration: description,
      external_feed_id: `${parsedDate.toISOString()}-${reference}-${credit ?? ''}-${debit ?? ''}-${i}`,
    });
  }

  return rows;
}

export function validateCdrRows(rows: CdrImportRow[]): { valid: CdrImportRow[]; skipped: number } {
  const valid = rows.filter((r) => {
    const hasAmount = (r.credit ?? 0) > 0 || (r.debit ?? 0) > 0;
    return hasAmount && Boolean(r.transaction_date);
  });
  return { valid, skipped: rows.length - valid.length };
}
