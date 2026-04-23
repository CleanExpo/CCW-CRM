'use client';

import Link from 'next/link';
import { FileText, Package, ShoppingCart, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTIONS = [
  {
    href: '/orders?create=1',
    label: 'New order',
    icon: ShoppingCart,
  },
  {
    href: '/quotes?create=1',
    label: 'New quote',
    icon: FileText,
  },
  {
    href: '/products?create=1',
    label: 'New product',
    icon: Package,
  },
  {
    href: '/customers?create=1',
    label: 'New customer',
    icon: UserPlus,
  },
] as const;

export function DashboardQuickActions({ className }: { className?: string }) {
  return (
    <nav
      className={cn('flex flex-wrap items-center gap-2', className)}
      aria-label="Quick create actions"
    >
      {ACTIONS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/55 px-3 text-xs font-medium text-zinc-200 shadow-sm backdrop-blur-sm transition-colors hover:border-sky-400/30 hover:bg-zinc-800/75 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:outline-none sm:text-sm"
        >
          <Icon className="h-3.5 w-3.5 text-sky-300/90" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
