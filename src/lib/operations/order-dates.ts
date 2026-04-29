import { format } from 'date-fns';

/** API list/detail use `created_at`; some clients still send `order_date`. */
type OrderLike = {
  order_date?: string | null;
  created_at?: string | null;
};

export function getOrderDate(order: OrderLike): Date | null {
  const raw = order.order_date ?? order.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatOrderDatePart(
  order: OrderLike,
  dateFormat: string,
  empty = '—'
): string {
  const d = getOrderDate(order);
  if (!d) return empty;
  return format(d, dateFormat);
}
