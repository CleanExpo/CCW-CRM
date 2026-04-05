import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Order Approval — CCW',
  description: 'Review and approve your order from CCW',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
