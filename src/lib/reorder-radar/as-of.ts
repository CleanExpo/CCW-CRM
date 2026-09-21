/** Today's date in Brisbane, where the business runs, as YYYY-MM-DD. */
export function todayInBrisbane(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(now);
}

/** Validates an ?as_of= value; returns null when it is not a real calendar date. */
export function parseAsOf(raw: string | null): string | null {
  if (!raw) return todayInBrisbane();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw ? raw : null;
}
