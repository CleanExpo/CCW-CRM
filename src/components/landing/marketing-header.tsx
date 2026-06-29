'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { CcwLogo } from '@/components/brand/ccw-logo';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { marketingShell } from '@/components/landing/marketing-shell';

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
] as const;

export function MarketingHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.12] bg-zinc-950/80 backdrop-blur-2xl supports-backdrop-filter:bg-zinc-950/75">
      {/* Gradient hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"
        aria-hidden
      />
      <div
        className={cn(
          marketingShell,
          'flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6 md:py-4'
        )}
      >
        <CcwLogo href="/" variant="full" size="md" />

        <nav
          className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-semibold md:flex-1 md:justify-center"
          aria-label="Main"
        >
          <div className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5 shadow-inner shadow-black/20 backdrop-blur-sm">
            {NAV.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'rounded-full px-3.5 py-2 whitespace-nowrap transition-all duration-200',
                    active
                      ? 'bg-gradient-to-r from-sky-500/25 to-indigo-600/25 text-white shadow-sm ring-1 ring-sky-500/30'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 md:justify-end">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'min-h-9 rounded-full border-white/15 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 hover:border-white/25 hover:bg-white/[0.07] hover:text-white'
            )}
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: 'gradient', size: 'sm' }),
              'min-h-9 min-w-[7.5rem] rounded-full px-5 text-sm font-semibold shadow-lg shadow-sky-500/25 ring-1 ring-white/15 transition hover:brightness-110'
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
