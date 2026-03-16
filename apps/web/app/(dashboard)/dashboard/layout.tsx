import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'CCW Online ERP dashboard — live overview of sales, inventory, orders, and customer activity.',
  robots: { index: false, follow: false },
};

export default function DashboardPageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
