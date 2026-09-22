'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { apiClient } from '@/lib/api/client';

type Plan = {
  id: string;
  equipment_id: string;
  machine: string;
  serial_number: string;
  customer: string;
  interval_months: number | null;
  interval_hours: number | null;
  price: number | null;
  renewal_date: string;
};

/** UNI-2750: staff list of service plans, filtered to renewals coming up. */
export default function ServicePlansPage() {
  const [within, setWithin] = useState<number | null>(30);
  const [items, setItems] = useState<Plan[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const q = within === null ? '' : `?renewal_within_days=${within}`;
      setItems((await apiClient.get<{ items: Plan[] }>(`/api/workshop/plans${q}`)).items);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setState('error');
    }
  }, [within]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Service plans</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Machines on a yearly plan. Renewals are for staff to follow up by phone; nothing here
            contacts a customer. Add a plan from the machine&rsquo;s equipment page.
          </p>
        </div>
        <div className="flex gap-2">
          {[
            [30, 'Renewing in 30 days'],
            [90, '90 days'],
            [null, 'All active'],
          ].map(([v, label]) => (
            <Button
              key={String(v)}
              size="sm"
              variant={within === v ? 'default' : 'outline'}
              onClick={() => setWithin(v as number | null)}
            >
              {label}
            </Button>
          ))}
        </div>
        {state === 'loading' && <div className="bg-muted h-24 animate-pulse rounded-lg" />}
        {state === 'error' && (
          <p className="text-sm text-red-600">
            Could not load plans: {error}. This is a failed read, not an empty list.
          </p>
        )}
        {state === 'ready' &&
          (items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No plans in this view.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Machine</th>
                    <th className="px-3 py-2 text-left">Interval</th>
                    <th className="px-3 py-2 text-left">Price</th>
                    <th className="px-3 py-2 text-left">Renews</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2">{p.customer}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/workshop/equipment/${p.equipment_id}`}
                          className="underline"
                        >
                          {p.machine}
                        </Link>
                        <div className="font-mono text-xs">{p.serial_number}</div>
                      </td>
                      <td className="px-3 py-2">
                        {[
                          p.interval_months && `${p.interval_months} mo`,
                          p.interval_hours && `${p.interval_hours} h`,
                        ]
                          .filter(Boolean)
                          .join(' / ')}
                      </td>
                      <td className="px-3 py-2">
                        {p.price == null ? 'Not set' : `$${p.price.toFixed(2)}`}
                      </td>
                      <td className="px-3 py-2">
                        {new Date(p.renewal_date).toLocaleDateString('en-AU')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </ErrorBoundary>
  );
}
