'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type ServiceReminder } from '@/lib/api/workshop';
import { Bell, RefreshCw, Send } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  suppressed: 'bg-gray-100 text-gray-600',
};

const TYPE_LABELS: Record<string, string> = {
  '90_day': '90 Day',
  '30_day': '30 Day',
  '7_day': '7 Day',
  overdue: 'Overdue',
};

export default function RemindersPage() {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<ServiceReminder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [generating, setGenerating] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workshopApi.listReminders({
        status: statusFilter || undefined,
        page_size: 100,
      });
      setReminders(data.items);
      setTotal(data.total);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await workshopApi.generateReminders();
      toast({ title: 'Reminders generated', description: result.message });
      load();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendAll() {
    setSendingAll(true);
    try {
      const result = await workshopApi.sendPendingReminders();
      toast({ title: 'Reminders sent', description: result.message });
      load();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setSendingAll(false);
    }
  }

  async function handleSend(id: string) {
    try {
      await workshopApi.sendReminder(id);
      toast({ title: 'Reminder sent' });
      load();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    }
  }

  async function handleSuppress(id: string) {
    try {
      await workshopApi.suppressReminder(id);
      toast({ title: 'Reminder suppressed' });
      load();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Service Reminders</h1>
          <p className="text-muted-foreground">{total} reminders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={generating}>
            <Bell className="mr-2 h-4 w-4" /> {generating ? 'Generating...' : 'Generate Reminders'}
          </Button>
          <Button onClick={handleSendAll} disabled={sendingAll}>
            <Send className="mr-2 h-4 w-4" /> {sendingAll ? 'Sending...' : 'Send All Pending'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'pending', 'sent', 'failed', 'suppressed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-muted-foreground">Loading reminders...</div>
      ) : reminders.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center">
          No {statusFilter} reminders found.
          {statusFilter === 'pending' &&
            ' Click "Generate Reminders" to create reminders for due equipment.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Equipment</th>
                <th className="px-4 py-3 text-left font-medium">Scheduled Send</th>
                <th className="px-4 py-3 text-left font-medium">Sent At</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reminders.map((reminder) => (
                <tr key={reminder.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        STATUS_COLORS[reminder.reminder_type] || 'bg-gray-100 text-gray-600'
                      }
                    >
                      {TYPE_LABELS[reminder.reminder_type] || reminder.reminder_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {reminder.equipment_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    {new Date(reminder.scheduled_send_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {reminder.sent_at ? (
                      new Date(reminder.sent_at).toLocaleDateString()
                    ) : (
                      <span className="text-muted-foreground">{'\u2014'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[reminder.status] || ''}`}
                    >
                      {reminder.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {reminder.status === 'pending' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleSend(reminder.id)}>
                            Send
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => handleSuppress(reminder.id)}
                          >
                            Suppress
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
