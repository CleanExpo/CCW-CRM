'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers3, LogIn } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { marketingShell } from '@/components/landing/marketing-shell';

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/features', label: 'Features' },
] as const;

export function MarketingHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/15 bg-zinc-950/95 backdrop-blur-xl supports-backdrop-filter:bg-zinc-950/90">
      <div
        className={cn(
          marketingShell,
          'flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6 md:py-5'
        )}
      >
        <Link href="/" className="group flex min-w-0 shrink-0 items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg ring-2 shadow-sky-500/30 ring-white/25 transition-transform group-hover:scale-[1.02]">
            <Layers3 className="relative z-10 h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-base font-bold tracking-tight text-white sm:text-lg">
              CCW Online
            </span>
            <span className="block truncate text-[11px] font-medium text-zinc-300 sm:text-xs">
              Equipment supplier operations
            </span>
          </div>
        </Link>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold md:flex-1 md:justify-center"
          aria-label="Main"
        >
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'whitespace-nowrap underline-offset-4 transition-colors hover:text-white hover:underline',
                  active ? 'text-white' : 'text-zinc-400'
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 justify-center md:justify-end">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: 'gradient', size: 'sm' }),
              'min-h-9 min-w-[7.5rem] rounded-lg px-5 text-sm font-semibold shadow-lg shadow-sky-500/30 ring-1 ring-white/20 hover:brightness-110'
            )}
          >
            <LogIn className="h-4 w-4 shrink-0" aria-hidden />
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
