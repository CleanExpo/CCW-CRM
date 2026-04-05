import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reports & KPIs',
  description:
    'CCW sales and inventory KPI dashboards — revenue, AOV, reorder alerts, and Cin7 sync status.',
  robots: { index: false, follow: false },
};

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
