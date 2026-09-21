'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { priceMoleApi, type ComparisonItem } from '@/lib/api/price-mole';

/**
 * UNI-2751: printable CCW vs competitor price comparison. No cost or margin is
 * shown. Prices older than the freshness window are left off rather than shown
 * as current. Whether this goes to a customer is Toby's call per quote.
 */
function Comparison() {
  const ids = (useSearchParams().get('product_ids') ?? '').split(',').filter(Boolean);
  const key = ids.join(',');
  const [items, setItems] = useState<ComparisonItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    priceMoleApi
      .compare(key.split(','))
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [key]);

  if (!key) return <p className="p-6">No products selected.</p>;
  if (error) return <p className="p-6 text-red-600">Could not load the comparison: {error}</p>;
  if (!items) return <p className="p-6">Loading...</p>;

  const rows = items.flatMap((i) =>
    i.competitors
      .filter((c) => c.latest_price && !c.latest_price.stale)
      .map((c) => ({ item: i, c, p: c.latest_price! }))
  );
  const leftOff = items.reduce(
    (n, i) => n + i.competitors.filter((c) => !c.latest_price || c.latest_price.stale).length,
    0
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-muted-foreground text-sm">
          Staff preview. Check with Toby before this goes to a customer.
        </p>
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      <h1 className="text-2xl font-bold">Price comparison</h1>
      {rows.length === 0 ? (
        <p>No current competitor prices to compare.</p>
      ) : (
        <table className="w-full border text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="border px-3 py-2 text-left">Product</th>
              <th className="border px-3 py-2 text-right">CCW price</th>
              <th className="border px-3 py-2 text-left">Competitor</th>
              <th className="border px-3 py-2 text-right">Their price</th>
              <th className="border px-3 py-2 text-left">Price seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, c, p }) => (
              <tr key={c.id}>
                <td className="border px-3 py-2">{item.product.name}</td>
                <td className="border px-3 py-2 text-right">${item.product.price.toFixed(2)}</td>
                <td className="border px-3 py-2">{c.competitor}</td>
                <td className="border px-3 py-2 text-right">${p.price.toFixed(2)}</td>
                <td className="border px-3 py-2">
                  {new Date(p.captured_at).toLocaleDateString('en-AU')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-muted-foreground text-xs">
        Competitor prices are as published on their public websites on the date shown.
        {leftOff > 0 ? ` ${leftOff} older or missing price(s) were left off.` : ''}
      </p>
    </div>
  );
}

export default function QuoteComparePage() {
  return (
    <Suspense fallback={<p className="p-6">Loading...</p>}>
      <Comparison />
    </Suspense>
  );
}
