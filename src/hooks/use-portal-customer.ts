/**
 * UNI-2115: Hook to load the portal customer context from the authenticated session.
 *
 * Calls GET /api/portal/customer-context which returns the customer id and name
 * resolved server-side from the JWT. The hook is used by portal pages to show
 * account info and confirm the correct customer identity — it never reads a
 * customer_id from local state or component props.
 */

'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

export interface PortalCustomer {
  customer_id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
}

export function usePortalCustomer(): {
  customer: PortalCustomer | null;
  loading: boolean;
  error: string | null;
} {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<PortalCustomer>('/api/portal/customer-context')
      .then((data) => {
        if (!cancelled) setCustomer(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load customer context');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { customer, loading, error };
}
