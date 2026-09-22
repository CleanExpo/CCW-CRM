'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { PhoneCall } from 'lucide-react';

type Named = { id: string; name: string; sku: string };
type RadarCustomer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
};
type MachineNeed = { machine: string; products: Named[] };
type CadenceItem = {
  customer: RadarCustomer;
  product: Named;
  purchases: number;
  cadence_days: number;
  avg_quantity: number;
  last_purchase: string;
  expected: string;
  days_late: number;
  machine_needs: MachineNeed[];
};
type QuietItem = {
  customer: RadarCustomer;
  purchases: number;
  cadence_days: number;
  last_purchase: string;
  days_silent: number;
  machine_needs: MachineNeed[];
};
type RadarResponse = {
  as_of: string;
  due: CadenceItem[];
  overdue: CadenceItem[];
  gone_quiet: QuietItem[];
};

const OUTCOMES: { id: string; label: string }[] = [
  { id: 'ordered', label: 'Ordered' },
  { id: 'call_back', label: 'Call back' },
  { id: 'not_needed', label: 'Not needed yet' },
  { id: 'no_answer', label: 'No answer' },
  { id: 'lost', label: 'Buying elsewhere' },
];

type Tab = 'due' | 'overdue' | 'gone_quiet';

function when(daysLate: number) {
  if (daysLate < 0) return `due in ${-daysLate} day${daysLate === -1 ? '' : 's'}`;
  if (daysLate === 0) return 'due today';
  return `${daysLate} day${daysLate === 1 ? '' : 's'} late`;
}

function Needs({ needs }: { needs: MachineNeed[] }) {
  if (needs.length === 0) return null;
  return (
    <div className="text-muted-foreground mt-1 text-xs">
      {needs.map((m) => (
        <div key={m.machine}>
          {m.machine} takes: {m.products.map((p) => p.name).join(', ')}
        </div>
      ))}
    </div>
  );
}

/** UNI-2749: the morning call list — who is due, overdue, or has gone quiet. */
export function ReorderRadarPanel() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('due');
  const [data, setData] = useState<RadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logged, setLogged] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiClient.get<RadarResponse>('/api/crm/reorder-radar'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function logCall(
    key: string,
    customerId: string,
    productId: string | null,
    outcome: string
  ) {
    try {
      await apiClient.post('/api/crm/reorder-radar/calls', {
        customer_id: customerId,
        product_id: productId,
        outcome,
      });
      setLogged((prev) => ({ ...prev, [key]: outcome }));
      toast({ title: 'Call logged to activities' });
    } catch (e) {
      toast({
        title: 'Could not log the call',
        description: e instanceof Error ? e.message : 'Failed',
        variant: 'destructive',
      });
    }
  }

  function Outcomes({
    k,
    customerId,
    productId,
  }: {
    k: string;
    customerId: string;
    productId: string | null;
  }) {
    if (logged[k]) {
      return <Badge variant="secondary">{OUTCOMES.find((o) => o.id === logged[k])?.label}</Badge>;
    }
    return (
      <div className="flex flex-wrap justify-end gap-1">
        {OUTCOMES.map((o) => (
          <Button
            key={o.id}
            size="sm"
            variant="outline"
            onClick={() => logCall(k, customerId, productId, o.id)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    );
  }

  const counts = data
    ? { due: data.due.length, overdue: data.overdue.length, gone_quiet: data.gone_quiet.length }
    : null;
  const rows: CadenceItem[] = data && tab !== 'gone_quiet' ? data[tab] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneCall className="h-4 w-4" /> Reorder radar
        </CardTitle>
        <CardDescription>
          Worked out from each customer&rsquo;s own buying rhythm (three or more purchases, posted
          invoices only).{data ? ` As of ${data.as_of}.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {(
            [
              ['due', 'Due'],
              ['overdue', 'Overdue'],
              ['gone_quiet', 'Gone quiet'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? 'default' : 'outline'}
              onClick={() => setTab(id)}
            >
              {label}
              {counts ? ` (${counts[id]})` : ''}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="bg-muted h-20 animate-pulse rounded-lg" />
        ) : error ? (
          <p className="text-sm text-red-600">
            Could not load the reorder radar: {error}. This is a failed read, not an empty list.
          </p>
        ) : tab === 'gone_quiet' ? (
          data!.gone_quiet.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nobody with a buying rhythm has gone quiet.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {data!.gone_quiet.map((q) => {
                const k = `quiet:${q.customer.id}`;
                return (
                  <div key={k} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                    <div className="min-w-48 flex-1">
                      <div className="font-medium">{q.customer.company_name}</div>
                      <div className="text-muted-foreground text-xs">
                        {q.customer.contact_name ?? '—'} · {q.customer.phone ?? 'no phone'}
                      </div>
                      <Needs needs={q.machine_needs} />
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Usually every {Math.round(q.cadence_days)} days · silent {q.days_silent} days
                      (last {q.last_purchase})
                    </div>
                    <Outcomes k={k} customerId={q.customer.id} productId={null} />
                  </div>
                );
              })}
            </div>
          )
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {tab === 'due' ? 'Nobody is due in the next 7 days.' : 'Nothing overdue.'}
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {rows.map((r) => {
              const k = `${r.customer.id}:${r.product.id}`;
              return (
                <div key={k} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                  <div className="min-w-48 flex-1">
                    <div className="font-medium">{r.customer.company_name}</div>
                    <div className="text-muted-foreground text-xs">
                      {r.customer.contact_name ?? '—'} · {r.customer.phone ?? 'no phone'}
                    </div>
                    <Needs needs={r.machine_needs} />
                  </div>
                  <div className="min-w-48">
                    <div>{r.product.name}</div>
                    <div className="text-muted-foreground text-xs">
                      About {r.avg_quantity} every {Math.round(r.cadence_days)} days · last{' '}
                      {r.last_purchase}
                    </div>
                  </div>
                  <Badge variant={r.days_late > 0 ? 'destructive' : 'outline'}>
                    {when(r.days_late)}
                  </Badge>
                  <Outcomes k={k} customerId={r.customer.id} productId={r.product.id} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
