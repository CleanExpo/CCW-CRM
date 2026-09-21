'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';

type Row = {
  product_id: string;
  sku: string;
  name: string;
  category: string | null;
  unit_price: number;
};

/** UNI-2747: every product at this customer's own price. */
export default function PortalProductsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'shut' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const q = search ? `&search=${encodeURIComponent(search)}` : '';
      const res = await apiClient.get<{ items: Row[] }>(`/api/portal/my-prices?page_size=100${q}`);
      setRows(res.items);
      setState('ready');
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Failed';
      setMessage(text);
      setState(/not open yet/i.test(text) ? 'shut' : 'error');
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Prices shown are your account prices, ex GST.
        </p>
      </div>
      <Input
        className="max-w-sm"
        placeholder="Search by name or SKU"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {state === 'loading' && <p className="text-slate-400">Loading…</p>}
      {state === 'shut' && (
        <Card>
          <CardContent className="py-10 text-center text-slate-600">{message}</CardContent>
        </Card>
      )}
      {state === 'error' && (
        <p className="text-sm text-red-600">Could not load your prices: {message}</p>
      )}
      {state === 'ready' &&
        (rows.length === 0 ? (
          <p className="text-slate-500">No products match.</p>
        ) : (
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                    SKU
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                    Product
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase">
                    Your price
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product_id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.sku}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      ${r.unit_price.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
