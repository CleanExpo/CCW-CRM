import { CcwLogo } from '@/components/brand/ccw-logo';
import { marketingShell } from '@/components/landing/marketing-shell';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * Server component — keep out of the client bundle for LCP.
 * Single-row editorial nav (no pill cluster).
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#050508]/80 backdrop-blur-xl supports-backdrop-filter:bg-[#050508]/70">
      <div
        className={cn(
          marketingShell,
          'flex h-16 items-center justify-between gap-6 md:h-[4.25rem]'
        )}
      >
        <CcwLogo href="/" variant="full" size="md" />

        <nav
          className="hidden items-center gap-5 text-[13px] font-medium tracking-wide text-zinc-400 md:flex lg:gap-7"
          aria-label="Main"
        >
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="transition-colors duration-200 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/register"
            className="hidden min-h-9 items-center justify-center px-3 text-[13px] font-medium text-zinc-300 transition hover:text-white sm:inline-flex"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-9 items-center justify-center bg-sky-500 px-4 text-[13px] font-semibold text-zinc-950 transition hover:bg-sky-400 sm:px-5"
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
