'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { slaApi, type SLAInstance } from '@/lib/api/sla';

function formatDeadline(deadline: string): string {
  const d = new Date(deadline);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHrs = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) return 'Overdue';
  if (diffHrs < 1) return 'Due < 1h';
  if (diffHrs < 24) return `Due in ${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `Due in ${diffDays}d`;
}

export function TaskSLAPanel() {
  const [active, setActive] = useState<SLAInstance[]>([]);
  const [breached, setBreached] = useState<SLAInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [activeData, breachedData] = await Promise.all([
          slaApi.getInstances({ entity_type: 'task', breached: false }),
          slaApi.getInstances({ entity_type: 'task', breached: true }),
        ]);
        setActive(activeData);
        setBreached(breachedData);
      } catch {
        // non-fatal: panel just stays empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            SLA Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted h-10 animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = active.length + breached.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          SLA Deadlines
          {breached.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {breached.length} breached
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            No active SLA deadlines
          </div>
        ) : (
          <div className="space-y-2">
            {breached.map((sla) => (
              <div
                key={sla.id}
                className="border-destructive/30 bg-destructive/5 flex items-center justify-between rounded border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-destructive h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Task {sla.entity_id.slice(0, 8)}…</p>
                    <p className="text-muted-foreground text-xs">
                      {sla.entity_type} · SLA rule {sla.sla_rule_id.slice(0, 8)}…
                    </p>
                  </div>
                </div>
                <Badge variant="destructive" className="text-xs">
                  Breached
                </Badge>
              </div>
            ))}
            {active.map((sla) => {
              const label = formatDeadline(sla.deadline);
              const isNear = label.startsWith('Due < 1h') || label.startsWith('Due in 1h');
              return (
                <div
                  key={sla.id}
                  className="flex items-center justify-between rounded border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Clock
                      className={`h-4 w-4 flex-shrink-0 ${isNear ? 'text-amber-500' : 'text-muted-foreground'}`}
                    />
                    <div>
                      <p className="text-sm font-medium">Task {sla.entity_id.slice(0, 8)}…</p>
                      <p className="text-muted-foreground text-xs">
                        {sla.entity_type} · deadline {new Date(sla.deadline).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={isNear ? 'secondary' : 'outline'}
                    className={`text-xs ${isNear ? 'text-amber-700' : ''}`}
                  >
                    {label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
