'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type WorkshopCentre } from '@/lib/api/workshop';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export default function WorkshopCentresPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<WorkshopCentre[]>([]);
  const [draft, setDraft] = useState<Record<string, Partial<WorkshopCentre>>>({});

  const load = useCallback(async () => {
    try {
      const data = await workshopApi.listCentres();
      setItems(data.items);
    } catch (error: unknown) {
      toast({
        title: 'Could not load centres',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function field(code: string, key: keyof WorkshopCentre, fallback: unknown) {
    const d = draft[code];
    if (d && key in d) return d[key];
    return fallback;
  }

  async function save(code: string, formReceived?: boolean) {
    const row = items.find((i) => i.code === code);
    const patch = { ...row, ...draft[code], form_received: formReceived };
    try {
      await workshopApi.updateCentre(code, patch);
      toast({ title: `${row?.name ?? code} saved` });
      setDraft((p) => ({ ...p, [code]: {} }));
      load();
    } catch (error: unknown) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    }
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Workshop centres</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Holds Toby’s form: hours, techs, bays, labour rate, manager, outreach approver. Leave
            blank until the form arrives. Brisbane is the recommended pilot.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle>{c.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(
                  [
                    ['technician_count', 'Technicians', 'number'],
                    ['paid_hours_per_week', 'Paid hours / week', 'number'],
                    ['bay_count', 'Bays', 'number'],
                    ['labour_rate', 'Labour rate', 'number'],
                    ['manager_name', 'Manager', 'text'],
                    ['outreach_approver', 'Outreach approver', 'text'],
                  ] as const
                ).map(([key, label, type]) => (
                  <label key={key} className="block">
                    <span className="text-muted-foreground">{label}</span>
                    <input
                      type={type}
                      className="border-input mt-0.5 w-full rounded border bg-transparent px-2 py-1"
                      value={String(field(c.code, key, c[key]) ?? '')}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed =
                          type === 'number' ? (raw === '' ? null : Number(raw)) : raw;
                        setDraft((prev) => ({
                          ...prev,
                          [c.code]: { ...prev[c.code], [key]: parsed },
                        }));
                      }}
                    />
                  </label>
                ))}
                <p className="text-muted-foreground text-xs">
                  Form received: {c.form_received_at ? c.form_received_at.slice(0, 10) : 'not yet'}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => save(c.code)}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => save(c.code, true)}>
                    Mark form received
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
}
