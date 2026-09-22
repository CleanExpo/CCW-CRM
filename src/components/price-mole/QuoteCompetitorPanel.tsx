'use client';

import { useEffect, useState } from 'react';
import { priceMoleApi, type ComparisonItem } from '@/lib/api/price-mole';
import { PriceTag } from '@/components/price-mole/PriceTag';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; items: ComparisonItem[] };

function pct(v: number | null) {
  return v === null ? 'no cost on file' : `${v.toFixed(1)}%`;
}

/**
 * UNI-2751: CCW price beside confirmed competitor prices while a quote is built.
 * Staff only. Showing a comparison to a customer is Toby's call, per quote.
 */
export function QuoteCompetitorPanel({ productIds }: { productIds: string[] }) {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [include, setInclude] = useState(false);
  const key = [...new Set(productIds)].sort().join(',');

  useEffect(() => {
    if (!key) return;
    let live = true;
    setState({ phase: 'loading' });
    priceMoleApi
      .compare(key.split(','))
      .then((r) => live && setState({ phase: 'ready', items: r.items }))
      .catch(
        (e) =>
          live && setState({ phase: 'error', message: e instanceof Error ? e.message : 'Failed' })
      );
    return () => {
      live = false;
    };
  }, [key]);

  if (!key) return null;
  const withCompetitors =
    state.phase === 'ready' ? state.items.filter((i) => i.competitors.length > 0) : [];

  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="mb-2 font-medium">Competitor prices (staff only)</div>
      {state.phase === 'loading' && <p className="text-muted-foreground">Loading...</p>}
      {state.phase === 'error' && (
        <p className="text-red-600">
          Could not load competitor prices: {state.message}. This is a failed read, not &ldquo;no
          competitors&rdquo;.
        </p>
      )}
      {state.phase === 'ready' && withCompetitors.length === 0 && (
        <p className="text-muted-foreground">No confirmed competitor matches for these products.</p>
      )}
      {withCompetitors.map((item) => (
        <div key={item.product.id} className="border-t py-2 first:border-t-0">
          <div className="flex justify-between">
            <span className="font-medium">{item.product.name}</span>
            <span>
              CCW ${item.product.price.toFixed(2)} · margin {pct(item.ccw_margin)}
            </span>
          </div>
          {item.competitors.map((c) => (
            <div
              key={c.id}
              className="text-muted-foreground mt-1 flex flex-wrap justify-between gap-2"
            >
              <span>{c.competitor}</span>
              <PriceTag p={c.latest_price} />
              <span>margin if matched: {c.latest_price ? pct(c.margin_at_match) : 'n/a'}</span>
              {c.last_error && (
                <span className="text-amber-600">Last check failed: {c.last_error}</span>
              )}
            </div>
          ))}
        </div>
      ))}
      {withCompetitors.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={include}
              onChange={(e) => setInclude(e.target.checked)}
            />
            Prepare a comparison for this quote
          </label>
          <span className="text-muted-foreground text-xs">
            Off by default. Showing a competitor comparison to a customer is Toby&rsquo;s call for
            each quote.
          </span>
          {include && (
            <a
              className="underline"
              href={`/dashboard/operations/quotes/compare?product_ids=${encodeURIComponent(key)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open printable comparison
            </a>
          )}
        </div>
      )}
    </div>
  );
}
