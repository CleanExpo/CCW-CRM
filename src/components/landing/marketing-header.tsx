import { CcwLogo } from '@/components/brand/ccw-logo';
import { marketingShell } from '@/components/landing/marketing-shell';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { CSSProperties } from 'react';

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
] as const;

const display: CSSProperties = {
  fontFamily: 'var(--font-marketing-display), var(--font-marketing-body), sans-serif',
};

/**
 * Server component for LCP. Premium chrome + CSS-only mobile menu (no client JS).
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50">
      {/* Hairline sky accent */}
      <div
        className="h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent"
        aria-hidden
      />

      <div className="border-b border-white/[0.06] bg-[#050508]/85 backdrop-blur-2xl supports-backdrop-filter:bg-[#050508]/72">
        <div
          className={cn(
            marketingShell,
            'relative flex h-[4.25rem] items-center justify-between gap-4 md:h-[4.75rem] md:gap-8'
          )}
        >
          <CcwLogo
            href="/"
            variant="compact"
            size="md"
            idPrefix="mkt-header"
            className="relative z-10 [font-family:var(--font-marketing-display),var(--font-marketing-body),sans-serif]"
          />

          {/* Desktop nav — underline hover, no pills */}
          <nav
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex"
            aria-label="Main"
          >
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="group relative px-3.5 py-2 text-[13px] font-medium tracking-wide text-zinc-400 transition-colors duration-200 hover:text-white"
              >
                {label}
                <span
                  className="absolute inset-x-3.5 -bottom-px h-px origin-left scale-x-0 bg-sky-400/80 transition-transform duration-300 ease-out group-hover:scale-x-100"
                  aria-hidden
                />
              </Link>
            ))}
          </nav>

          <div className="relative z-10 flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="group inline-flex min-h-10 items-center justify-center gap-2 bg-sky-500 px-4 text-[13px] font-semibold text-zinc-950 transition hover:bg-sky-400 sm:px-5"
            >
              Log in
              <span
                className="translate-x-0 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              >
                →
              </span>
            </Link>

            {/* Mobile / tablet menu — native details, zero JS */}
            <details className="relative lg:hidden">
              <summary
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center border border-white/[0.1] bg-white/[0.03] text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] [&::-webkit-details-marker]:hidden"
                aria-label="Open menu"
              >
                <span className="flex w-4 flex-col gap-1" aria-hidden>
                  <span className="h-px w-full bg-current" />
                  <span className="h-px w-full bg-current" />
                  <span className="h-px w-3 bg-current" />
                </span>
              </summary>
              <div className="absolute top-[calc(100%+0.5rem)] right-0 w-[min(18rem,calc(100vw-2rem))] border border-white/[0.08] bg-[#0a0a0e]/98 p-2 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <nav className="flex flex-col" aria-label="Mobile">
                  {NAV.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="px-3 py-2.5 text-[14px] font-medium text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
                    >
                      {label}
                    </Link>
                  ))}
                  <div className="my-1 h-px bg-white/[0.06]" />
                  <Link
                    href="/login"
                    className="mt-1 bg-sky-500 px-3 py-2.5 text-center text-[14px] font-semibold text-zinc-950 transition hover:bg-sky-400"
                  >
                    Log in
                  </Link>
                </nav>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Quiet status strip under header on large screens */}
      <div className="hidden border-b border-white/[0.04] bg-black/40 md:block">
        <div
          className={cn(
            marketingShell,
            'flex h-8 items-center justify-between text-[11px] tracking-wide text-zinc-400'
          )}
        >
          <p style={display} className="font-medium tracking-[0.14em] uppercase">
            Operations platform
          </p>
          <p className="tabular-nums">Brisbane · Sydney · Melbourne</p>
        </div>
      </div>
    </header>
  );
}
