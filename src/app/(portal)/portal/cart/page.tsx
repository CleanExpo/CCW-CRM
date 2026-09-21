'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';

type Cart = {
  quote_id: string;
  quote_number: string;
  valid_until: string | null;
  quoted_prices_honoured: boolean;
  lines: { product_id: string; sku: string; name: string; quantity: number; unit_price: number }[];
};

/** UNI-2747: a quote CCW sent during a call, ready to order as a draft. */
function QuoteCart() {
  const quoteId = useSearchParams().get('quote');
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!quoteId) return;
    apiClient
      .get<Cart>(`/api/portal/quote-cart/${encodeURIComponent(quoteId)}`)
      .then(setCart)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [quoteId]);

  if (!quoteId) return <p className="text-slate-500">No quote in this link.</p>;
  if (error) return <p className="text-slate-700">{error}</p>;
  if (!cart) return <p className="text-slate-400">Loading…</p>;

  const subtotal = cart.lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote {cart.quote_number}</CardTitle>
        <p className="text-sm text-slate-500">
          {cart.quoted_prices_honoured
            ? `Quoted prices apply until ${new Date(cart.valid_until!).toLocaleDateString('en-AU')}.`
            : 'This quote has expired, so today’s account prices are shown.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <table className="w-full text-sm">
          <tbody>
            {cart.lines.map((l) => (
              <tr key={l.product_id} className="border-t">
                <td className="py-2">{l.name}</td>
                <td className="py-2 text-slate-500">× {l.quantity}</td>
                <td className="py-2 text-right">${(l.unit_price * l.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Subtotal (ex GST)</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {placed ? (
          <p className="text-green-700">Sent as {placed}. CCW will confirm your order.</p>
        ) : (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await apiClient.post<{ order_number: string }>(
                  `/api/portal/quote-cart/${encodeURIComponent(cart.quote_id)}`
                );
                setPlaced(r.order_number);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Send order to CCW
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function PortalCartPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Your quote</h1>
      <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
        <QuoteCart />
      </Suspense>
    </div>
  );
}
