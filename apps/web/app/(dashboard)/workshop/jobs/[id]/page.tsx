'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type JobCard, type TimeLog, type JobCardStatus } from '@/lib/api/workshop';
import { ArrowLeft, PlayCircle, StopCircle, Clock } from 'lucide-react';

const STATUS_COLORS: Record<JobCardStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

function fmtDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function JobCardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [card, setCard] = useState<JobCard | null>(null);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [techName, setTechName] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await workshopApi.getJob(id);
      setCard(data.job_card);
      setLogs(data.time_logs);
      // Find any running timer (stopped_at is null)
      const running = data.time_logs.find((l) => l.stopped_at === null);
      setTimerRunning(!!running);
      setActiveLogId(running?.id ?? null);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load job card',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStartTimer() {
    if (!techName.trim()) {
      toast({ title: 'Enter technician name before starting the timer', variant: 'destructive' });
      return;
    }
    setActing(true);
    try {
      const log = await workshopApi.createTimeLog(id, {
        technician_name: techName.trim(),
        started_at: new Date().toISOString(),
      });
      setLogs((prev) => [log, ...prev]);
      setTimerRunning(true);
      setActiveLogId(log.id);
      toast({ title: 'Timer started' });
      load();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start timer',
        variant: 'destructive',
      });
    } finally {
      setActing(false);
    }
  }

  async function handleStopTimer() {
    if (!activeLogId) return;
    setActing(true);
    try {
      await workshopApi.stopTimeLog(id, activeLogId, new Date().toISOString());
      setTimerRunning(false);
      setActiveLogId(null);
      toast({ title: 'Timer stopped' });
      load();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to stop timer',
        variant: 'destructive',
      });
    } finally {
      setActing(false);
    }
  }

  const totalMinutes = logs.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  if (!card) {
    return <div className="p-6 text-muted-foreground">Job card not found.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Link href="/workshop/jobs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Jobs
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{card.job_number}</span>
              <Badge className={STATUS_COLORS[card.status]}>{card.status.replace('_', ' ')}</Badge>
            </div>
            <h1 className="mt-1 text-2xl font-bold">{card.title}</h1>
            {card.assigned_technician && (
              <p className="text-sm text-muted-foreground">
                Assigned to: {card.assigned_technician}
              </p>
            )}
            {card.description && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {card.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Timer control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracking
            {totalMinutes > 0 && (
              <span className="ml-auto text-base font-normal text-muted-foreground">
                Total: {fmtDuration(totalMinutes)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {timerRunning ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                Timer running…
              </div>
              <Button
                onClick={handleStopTimer}
                disabled={acting}
                variant="destructive"
                size="sm"
              >
                <StopCircle className="mr-2 h-4 w-4" />
                Stop timer
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Technician name"
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartTimer()}
                className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button onClick={handleStartTimer} disabled={acting || !techName.trim()} size="sm">
                <PlayCircle className="mr-2 h-4 w-4" />
                Start timer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time log entries */}
      <Card>
        <CardHeader>
          <CardTitle>Time Log ({logs.length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No time entries yet.</p>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{log.technician_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(log.started_at)} · {fmtTime(log.started_at)}
                      {log.stopped_at ? ` → ${fmtTime(log.stopped_at)}` : ''}
                    </p>
                    {log.notes && (
                      <p className="text-xs text-neutral-500">{log.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {log.stopped_at ? (
                      <span className="text-sm font-medium">{fmtDuration(log.duration_minutes)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
                        Running
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
