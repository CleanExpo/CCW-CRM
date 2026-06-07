'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getCustomerTimeline,
  type UnifiedTimelineEvent,
} from '@/lib/api/customer-timeline';
import {
  Banknote,
  Calendar,
  FileText,
  Mail,
  MessageSquare,
  Receipt,
  ShoppingCart,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ICONS = {
  activity: MessageSquare,
  email: Mail,
  invoice: Receipt,
  payment: Banknote,
  order: ShoppingCart,
  quote: FileText,
} as const;

function EventIcon({ type }: { type: UnifiedTimelineEvent['event_type'] }) {
  const Icon = ICONS[type] ?? Calendar;
  return <Icon className="h-4 w-4" />;
}

export function UnifiedCustomerTimeline({ customerId }: { customerId: string }) {
  const { toast } = useToast();
  const [events, setEvents] = useState<UnifiedTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomerTimeline(customerId);
      setEvents(data.events);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Timeline error',
        description: e instanceof Error ? e.message : 'Failed to load timeline',
      });
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No activity yet — emails, invoices, orders, and notes will appear here in one timeline.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="bg-border absolute top-2 bottom-2 left-[15px] w-px" />
      {events.map((event) => (
        <div key={event.id} className="relative flex gap-4 pb-6 pl-1">
          <div className="bg-background border-primary/30 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
            <EventIcon type={event.event_type} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{event.title}</p>
              <Badge variant="outline" className="text-[10px] uppercase">
                {event.event_type.replace(/_/g, ' ')}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
              </span>
            </div>
            {event.description && (
              <p className="text-muted-foreground mt-1 text-sm">{event.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
