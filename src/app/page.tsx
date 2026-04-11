import type { Metadata } from 'next';
import { MarketingLanding } from '@/components/landing/marketing-landing';
import { BACKEND_URL } from '@/lib/api/backend-url';
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
 * Fetch public stats from the backend (server-side, no auth required).
 * Returns null if the backend is unreachable or returns a non-ok response.
 */
async function getPublicStats(): Promise<PublicStats | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/stats`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const stats = await getPublicStats();
  return <MarketingLanding stats={stats} />;
}
