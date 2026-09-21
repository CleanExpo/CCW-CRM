'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock } from 'lucide-react';

type Plan = {
  id: string;
  interval_months: number | null;
  interval_hours: number | null;
  price: number | null;
  includes: string;
  start_date: string;
  renewal_date: string;
};

/** UNI-2750: the machine's service plan, or a form to put it on one. */
export function ServicePlanCard({ equipmentId }: { equipmentId: string }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    interval_months: '12',
    interval_hours: '',
    price: '',
    includes: '',
    start_date: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items: Plan[] }>(
        `/api/workshop/plans?equipment_id=${encodeURIComponent(equipmentId)}`
      );
      setPlan(res.items[0] ?? null);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setState('error');
    }
  }, [equipmentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    try {
      await apiClient.post('/api/workshop/plans', { equipment_id: equipmentId, ...form });
      toast({ title: 'Plan added' });
      load();
    } catch (e) {
      toast({
        title: 'Could not add plan',
        description: e instanceof Error ? e.message : 'Failed',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" /> Service plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {state === 'loading' && <p className="text-muted-foreground">Loading...</p>}
        {state === 'error' && (
          <p className="text-red-600">
            Could not load the plan: {error}. This is a failed read, not &ldquo;no plan&rdquo;.
          </p>
        )}
        {state === 'ready' && plan && (
          <div className="space-y-1">
            <div>
              Every{' '}
              {[
                plan.interval_months && `${plan.interval_months} months`,
                plan.interval_hours && `${plan.interval_hours}h`,
              ]
                .filter(Boolean)
                .join(' or ')}
            </div>
            <div className="text-muted-foreground">
              Renews {new Date(plan.renewal_date).toLocaleDateString('en-AU')} ·{' '}
              {plan.price == null ? 'price not set' : `$${plan.price.toFixed(2)}`}
            </div>
            {plan.includes && (
              <div className="text-muted-foreground">Includes: {plan.includes}</div>
            )}
          </div>
        )}
        {state === 'ready' && !plan && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Every N months"
              value={form.interval_months}
              onChange={(e) => setForm({ ...form, interval_months: e.target.value })}
            />
            <Input
              placeholder="Or every N hours"
              value={form.interval_hours}
              onChange={(e) => setForm({ ...form, interval_hours: e.target.value })}
            />
            <Input
              placeholder="Price (optional)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              className="col-span-2"
              placeholder="What the plan includes"
              value={form.includes}
              onChange={(e) => setForm({ ...form, includes: e.target.value })}
            />
            <Button className="col-span-2" onClick={save}>
              Put this machine on a plan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
