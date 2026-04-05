import type { Metadata } from 'next';
import Link from 'next/link';
import { ShoppingCart, DollarSign, LayoutDashboard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Supplier Portal — CCW',
  description: 'Manage purchase orders and delivery confirmations for CCW Online',
  robots: { index: false, follow: false },
};

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/supplier', icon: LayoutDashboard },
  { label: 'Purchase Orders', href: '/supplier/orders', icon: ShoppingCart },
  { label: 'Payments', href: '/supplier/orders?tab=payments', icon: DollarSign },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/supplier" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-xs font-bold text-white">
              CCW
            </div>
            <span className="text-sm font-semibold text-slate-800">Supplier Portal</span>
          </Link>
          <nav className="flex items-center gap-1">
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
          <div className="text-xs text-slate-500">CleanTech Equipment Pty Ltd</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      <footer className="border-t bg-white py-4 text-center text-xs text-slate-400">
        CCW Online Pty Ltd — Supplier Self-Service Portal
      </footer>
    </div>
  );
}
