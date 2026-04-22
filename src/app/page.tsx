import type { Metadata } from 'next';
import { MarketingLanding } from '@/components/landing/marketing-landing';
import { getAppOrigin } from '@/lib/api/backend-url';
import type { PublicStats } from '@/components/landing/LiveStatsBar';

export const metadata: Metadata = {
  title: 'CCW Online ERP — Operations platform for equipment suppliers',
  description:
    'Unify quotes, orders, inventory, and fulfilment for Australian cleaning-equipment wholesalers. One spine for sales, warehouse, finance, and customer service—built for teams who move real SKUs.',
  openGraph: {
    title: 'CCW Online ERP — Operations platform for equipment suppliers',
    description:
      'Unify quotes, orders, inventory, and fulfilment. Built for equipment suppliers who need one calm operational core.',
    type: 'website',
  },
};

/**
 * Fetch public stats (server-side, no auth required).
 * Returns null if unreachable or non-ok.
 */
async function getPublicStats(): Promise<PublicStats | null> {
  try {
    const res = await fetch(`${getAppOrigin()}/api/public/stats`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return null;
    return (await res.json()) as PublicStats;
  } catch {
    return null;
  }
}

export default async function Home() {
  const stats = await getPublicStats();
  return <MarketingLanding stats={stats} />;
}
