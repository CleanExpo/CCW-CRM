'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  CheckCircle,
  GitMerge,
  Mail,
  MessageSquare,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';

type CommsHubEvent = {
  id: string;
  kind: 'operational' | 'email' | 'notification';
  occurred_at: string;
  title: string;
  description: string | null;
  customer_id: string | null;
  customer_name: string | null;
  source: string;
  metadata: Record<string, unknown>;
};

type CommsHubResponse = {
  summary: {
    open_email_threads: number;
    unread_notifications: number;
    pending_approvals: number;
    recent_events_count: number;
  };
  events: CommsHubEvent[];
};

const KIND_ICON = {
  operational: Zap,
  email: Mail,
  notification: Bell,
} as const;

const KIND_LABEL = {
  operational: 'Operational',
  email: 'Email',
  notification: 'Alert',
} as const;

export default function CommsHubPage() {
  const { toast } = useToast();
  const [data, setData] = useState<CommsHubResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<CommsHubResponse>('/api/comms/hub');
      setData(res);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Comms hub error',
        description: e instanceof Error ? e.message : 'Failed to load communications feed',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <MessageSquare className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Optix Communications</h1>
            <p className="text-muted-foreground text-sm">
              Unified feed of emails, operational events, and workspace alerts
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-14 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Open email threads</CardDescription>
                <CardTitle className="text-3xl">{summary?.open_email_threads ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/finance/emails" className="text-primary text-xs hover:underline">
                  View inbox →
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Unread alerts</CardDescription>
                <CardTitle className="text-3xl">{summary?.unread_notifications ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending approvals</CardDescription>
                <CardTitle className="text-3xl">{summary?.pending_approvals ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/approvals" className="text-primary text-xs hover:underline">
                  Review approvals →
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Recent activity</CardDescription>
                <CardTitle className="text-3xl">{summary?.recent_events_count ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/workflows" className="text-primary text-xs hover:underline">
                  Workflow automation →
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/finance/emails">
            <Mail className="mr-2 h-4 w-4" />
            Email inbox
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/workflows">
            <GitMerge className="mr-2 h-4 w-4" />
            Workflows
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/approvals">
            <CheckCircle className="mr-2 h-4 w-4" />
            Approvals
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity feed</CardTitle>
          <CardDescription>
            Cross-channel timeline — emails, workflow events, invoices, orders, and system alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !data?.events.length ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No communications yet. Customer emails, workflow runs, and operational updates will
              appear here.
            </p>
          ) : (
            <div className="relative space-y-0">
              {data.events.map((event) => {
                const Icon = KIND_ICON[event.kind] ?? MessageSquare;
                return (
                  <div
                    key={event.id}
                    className="border-border relative flex gap-4 border-l-2 py-4 pl-6 last:pb-0"
                  >
                    <div className="bg-muted absolute top-5 -left-[9px] rounded-full p-1">
                      <Icon className="text-muted-foreground h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{event.title}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {KIND_LABEL[event.kind]}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {event.source}
                        </Badge>
                      </div>
                      {event.description && (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {event.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {event.customer_name && event.customer_id && (
                          <Link
                            href={`/dashboard/crm/customers/${event.customer_id}`}
                            className="text-primary text-xs hover:underline"
                          >
                            {event.customer_name}
                          </Link>
                        )}
                        <span className="text-muted-foreground text-[10px]">
                          {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
