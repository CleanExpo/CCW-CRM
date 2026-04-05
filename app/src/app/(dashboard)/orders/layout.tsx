import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Orders',
  description: 'View and manage CCW customer orders — status tracking, line items, and fulfilment.',
  robots: { index: false, follow: false },
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
