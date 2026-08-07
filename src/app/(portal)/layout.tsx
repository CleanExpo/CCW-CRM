import '../globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Package, FileText, Award, Wrench, LayoutDashboard, Truck } from 'lucide-react';
import { CcwLogo } from '@/components/brand/ccw-logo';

export const metadata: Metadata = {
  title: 'Customer Portal — CCW',
  description: 'Manage your orders, invoices, and certifications with CCW Online',
  robots: { index: false, follow: false },
};

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/portal', icon: LayoutDashboard },
  { label: 'Orders', href: '/portal/orders', icon: Package },
  { label: 'Tracking', href: '/portal/tracking', icon: Truck },
  { label: 'Invoices', href: '/portal/invoices', icon: FileText },
  { label: 'Certifications', href: '/portal/certifications', icon: Award },
  { label: 'Service Requests', href: '/portal/service', icon: Wrench },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <CcwLogo
            href="/portal"
            variant="compact"
            size="sm"
            title="Customer Portal"
            showTagline={false}
            theme="light"
          />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="text-xs text-slate-500">Brisbane Carpet Care Pty Ltd</div>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="border-b bg-white md:hidden">
        <nav className="flex overflow-x-auto px-4 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 flex-col items-center gap-0.5 px-3 py-1 text-xs text-slate-600"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="border-t bg-white py-4 text-center text-xs text-slate-400">
        CCW Online Pty Ltd — Customer Self-Service Portal
      </footer>
    </div>
  );
}
