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
  service_template_id?: string | null;
};

type Template = { id: string; name: string };

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
    service_template_id: '',
  });
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [templatesFailed, setTemplatesFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ items: Template[] }>('/api/workshop/templates?is_active=true&page_size=100')
      .then((res) => setTemplates(res.items))
      .catch(() => setTemplatesFailed(true));
  }, []);

  const templateName = (id: string | null | undefined) => {
    if (templatesFailed) return 'could not load the template name';
    if (templates === null) return 'loading...';
    return templates.find((t) => t.id === id)?.name ?? 'inactive or deleted template';
  };

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

  async function cancelPlan(id: string) {
    try {
      await apiClient.delete(`/api/workshop/plans/${id}`);
      toast({ title: 'Plan cancelled' });
      load();
    } catch (e) {
      toast({
        title: 'Could not cancel plan',
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
            {plan.service_template_id ? (
              <div className="text-muted-foreground">
                Template: {templateName(plan.service_template_id)}
              </div>
            ) : (
              <div className="text-amber-700">
                No service template, so bookings from this plan start without template items. Cancel
                the plan and add it again with a template to fix this.
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => cancelPlan(plan.id)}>
              Cancel plan
            </Button>
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
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-muted-foreground">Service template</span>
              <select
                aria-label="Service template"
                value={form.service_template_id}
                onChange={(e) => setForm({ ...form, service_template_id: e.target.value })}
                className="bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="">No template</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {templatesFailed && (
                <span className="text-red-600">
                  Could not load service templates. This is a failed read, not &ldquo;no
                  templates&rdquo;.
                </span>
              )}
            </label>
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
