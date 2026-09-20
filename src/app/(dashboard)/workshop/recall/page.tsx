'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type RecallQueueItem } from '@/lib/api/workshop';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

const STATUSES = [
  { id: 'queued', label: 'Queued' },
  { id: 'ready_to_book', label: 'Ready to book (staff only)' },
  { id: 'held', label: 'Held' },
  { id: 'wrong_customer', label: 'Wrong customer' },
  { id: 'wrong_machine', label: 'Wrong machine' },
];

export default function WorkshopRecallPage() {
  const { toast } = useToast();
  const [centre, setCentre] = useState('brisbane');
  const [items, setItems] = useState<RecallQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workshopApi.listRecallQueue(centre);
      setItems(data.items);
    } catch (error: unknown) {
      toast({
        title: 'Could not load recall queue',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [centre, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(equipmentId: string, status: string) {
    try {
      await workshopApi.reviewRecall(equipmentId, {
        status,
        notes: notes[equipmentId],
      });
      toast({ title: 'Review saved — customer was not contacted' });
      load();
    } catch (error: unknown) {
      toast({
        title: 'Review failed',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    }
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Recall review</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Staff check customer and machine before any booking. Outreach is blocked until Phase 1
            stock is signed and the workshop scope note is agreed. Brisbane is the pilot centre.
          </p>
        </div>
        <div className="flex gap-2">
          {['brisbane', 'sydney', 'melbourne'].map((c) => (
            <Button
              key={c}
              variant={centre === c ? 'default' : 'outline'}
              size="sm"
              className="capitalize"
              onClick={() => setCentre(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        {loading ? (
          <div className="bg-muted h-24 animate-pulse rounded-lg" />
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No due equipment in the next 14 days for this centre. Equipment needs a next service
            date.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Machine</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.company_name}</div>
                      <div className="text-muted-foreground text-xs">{row.contact_name ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>
                        {row.make} {row.model}
                      </div>
                      <div className="font-mono text-xs">{row.serial_number}</div>
                    </td>
                    <td className="px-3 py-2">{row.next_service_date ?? '—'}</td>
                    <td className="px-3 py-2">{row.status.replaceAll('_', ' ')}</td>
                    <td className="px-3 py-2">
                      <input
                        className="border-input mb-2 w-full rounded border bg-transparent px-2 py-1 text-xs"
                        placeholder="Note"
                        value={notes[row.equipment_id] ?? row.notes ?? ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [row.equipment_id]: e.target.value }))
                        }
                      />
                      <div className="flex flex-wrap gap-1">
                        {STATUSES.map((s) => (
                          <Button
                            key={s.id}
                            size="sm"
                            variant="outline"
                            onClick={() => review(row.equipment_id, s.id)}
                          >
                            {s.label}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
