/**
 * Cin7 Real-Time SSE Hook
 *
 * Subscribe to Cin7 sync events via Server-Sent Events.
 * Receives product, customer, sales, and inventory change notifications.
 */

import { useSSE } from './use-sse';

/**
 * Cin7 sync event from SSE stream
 */
export interface Cin7SyncEvent {
  event_type: string;
  entity_type: 'product' | 'customer' | 'sales' | 'inventory';
  entity_id?: string;
  action: 'created' | 'updated' | 'deleted' | 'synced';
  source: 'core' | 'omni';
  records_affected?: number;
  timestamp: string;
}

/**
 * Hook for subscribing to Cin7 sync events via SSE.
 *
 * @param enabled - Enable/disable connection (default: true)
 */
export function useCin7Stream(enabled = true) {
  const apiBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || '';
  return useSSE<Cin7SyncEvent>({
    url: `${apiBase}/api/integrations/cin7/stream`,
    enabled,
    autoReconnect: true,
    reconnectDelay: 5000,
    maxReconnectAttempts: 10,
  });
}
