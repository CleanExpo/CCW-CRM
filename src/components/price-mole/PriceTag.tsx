import { Badge } from '@/components/ui/badge';
import type { PresentedPrice } from '@/lib/api/price-mole';

/** A competitor price is never shown without the date it was seen. */
export function PriceTag({ p }: { p: PresentedPrice | null }) {
  if (!p) return <span className="text-muted-foreground">No price yet</span>;
  const date = new Date(p.captured_at).toLocaleDateString('en-AU');
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="font-medium">${p.price.toFixed(2)}</span>
      <span className="text-muted-foreground text-xs">
        seen {date}
        {p.source === 'manual' ? ' (entered by staff)' : ''}
      </span>
      {p.stale && <Badge variant="destructive">Stale, {p.age_days} days old</Badge>}
    </span>
  );
}
