import { apiClient } from '@/lib/api/client';

export type UnifiedTimelineEvent = {
  id: string;
  event_type: 'activity' | 'email' | 'invoice' | 'order' | 'quote' | 'payment' | 'operational';
  occurred_at: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
};

export async function getCustomerTimeline(
  customerId: string,
  limit = 100
): Promise<{ events: UnifiedTimelineEvent[]; count: number }> {
  return apiClient.get(`/api/customers/${customerId}/timeline?limit=${limit}`);
}

export function timelineEventIcon(type: UnifiedTimelineEvent['event_type']): string {
  switch (type) {
    case 'email':
      return 'mail';
    case 'invoice':
      return 'receipt';
    case 'payment':
      return 'banknote';
    case 'order':
      return 'cart';
    case 'quote':
      return 'file';
    case 'operational':
      return 'zap';
    default:
      return 'activity';
  }
}
