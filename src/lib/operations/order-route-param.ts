/** Postgres UUID string (hex with dashes). */
const ORDER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeOrderRouteParam(raw: string | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim();
  return s.length > 0 ? s : null;
}

export function orderRouteParamIsUuid(param: string): boolean {
  return ORDER_UUID_RE.test(param);
}
