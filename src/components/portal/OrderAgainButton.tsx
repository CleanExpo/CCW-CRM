'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';

type Result = { order_number: string; unavailable_product_ids: string[] };

/** UNI-2747: repeats a past order, or one line of it, as a draft for CCW to confirm. */
export function OrderAgainButton({
  orderId,
  lineId,
  label = 'Order again',
}: {
  orderId: string;
  lineId?: string;
  label?: string;
}) {
  const [state, setState] = useState<
    | { phase: 'idle' }
    | { phase: 'busy' }
    | { phase: 'done'; r: Result }
    | { phase: 'error'; message: string }
  >({ phase: 'idle' });

  if (state.phase === 'done') {
    return (
      <span className="text-xs text-green-700">
        Sent as {state.r.order_number}. CCW will confirm it.
        {state.r.unavailable_product_ids.length > 0 &&
          ` ${state.r.unavailable_product_ids.length} item(s) are no longer available and were left off.`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={state.phase === 'busy'}
        onClick={async (e) => {
          e.stopPropagation();
          setState({ phase: 'busy' });
          try {
            const r = await apiClient.post<Result>(`/api/portal/orders/${orderId}/order-again`, {
              line_ids: lineId ? [lineId] : undefined,
            });
            setState({ phase: 'done', r });
          } catch (err) {
            setState({ phase: 'error', message: err instanceof Error ? err.message : 'Failed' });
          }
        }}
      >
        {state.phase === 'busy' ? 'Sending...' : label}
      </Button>
      {state.phase === 'error' && <span className="text-xs text-red-600">{state.message}</span>}
    </span>
  );
}
