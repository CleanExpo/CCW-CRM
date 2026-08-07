import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { CcwLogo } from '@/components/brand/ccw-logo';
import { cn } from '@/lib/utils';
import { marketingShell } from '@/components/landing/marketing-shell';

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * Server component on purpose. `usePathname` previously forced this header
 * (and its logo/button graph) into the client bundle on every marketing page,
 * including `/` before LCP. Active-route chrome is a nicety; LCP is not.
 * Do not call `buttonVariants` here — that helper is client-bound.
 *
 * Every link here sets `prefetch={false}`. This header is above the fold on
 * `/`, so App Router's default viewport prefetch fired an RSC request per link
 * the moment the router mounted — measured 2026-08-07 as 34 requests / ~65KB
 * on every run, contending for bandwidth in the FCP→LCP window. Navigation
 * still works; it just fetches on click instead of on sight.
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.12] bg-zinc-950/80 backdrop-blur-2xl supports-backdrop-filter:bg-zinc-950/75">
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
        <CcwLogo href="/" prefetch={false} variant="full" size="md" />

        <nav
          className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-semibold md:flex-1 md:justify-center"
          aria-label="Main"
        >
          <div className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5 shadow-inner shadow-black/20 backdrop-blur-sm">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="rounded-full px-3.5 py-2 whitespace-nowrap text-zinc-400 transition-all duration-200 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 md:justify-end">
          <Link
            href="/register"
            prefetch={false}
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            prefetch={false}
            className="from-primary inline-flex min-h-9 min-w-[7.5rem] items-center justify-center gap-2 rounded-full bg-gradient-to-r to-indigo-500 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 ring-1 ring-white/15 transition hover:brightness-110"
          >
            <LogIn className="h-4 w-4 shrink-0" aria-hidden />
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
