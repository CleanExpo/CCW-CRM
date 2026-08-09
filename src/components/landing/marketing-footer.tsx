import { CcwLogo } from '@/components/brand/ccw-logo';
import { marketingShell } from '@/components/landing/marketing-shell';
import { cn } from '@/lib/utils';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';

const PRODUCT = [
  { href: '/product', label: 'Overview' },
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
] as const;

const COMPANY = [
  { href: '/contact', label: 'Contact' },
  { href: '/login', label: 'Sign in' },
  { href: '/register', label: 'Sign up' },
] as const;

const LEGAL = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

const display: CSSProperties = {
  fontFamily: 'var(--font-marketing-display), var(--font-marketing-body), sans-serif',
};

/**
 * Server component — premium closing chrome for the marketing site.
 */
export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-[#050508]">
      {/* Depth wash */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_0%,rgba(14,165,233,0.1),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent"
        aria-hidden
      />

      <div className={cn(marketingShell, 'relative')}>
        {/* Primary band — brand statement + CTA */}
        <div className="grid gap-10 border-b border-white/[0.06] py-16 md:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-16">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] text-sky-400/90 uppercase">
              CCW Online
            </p>
            <p
              className="mt-4 max-w-[14ch] text-[clamp(2rem,4.2vw,3.5rem)] leading-[1.02] font-semibold tracking-tight text-white"
              style={display}
            >
              One spine for the whole operation
            </p>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-zinc-400">
              Quotes, stock, and fulfilment for Australian equipment wholesalers who move real SKUs.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center bg-sky-500 px-6 text-[14px] font-semibold text-zinc-950 transition hover:bg-sky-400"
            >
              Enter workspace
            </Link>
            <Link
              href="/contact"
              className="group inline-flex h-12 items-center justify-center gap-2 border border-white/15 px-6 text-[14px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.04]"
            >
              Talk to sales
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.1fr_repeat(3,0.7fr)] lg:gap-10 lg:py-16">
          <div>
            <CcwLogo
              variant="compact"
              size="md"
              title="CCW Online"
              idPrefix="footer-logo"
              className="[font-family:var(--font-marketing-display),var(--font-marketing-body),sans-serif]"
            />
            <a
              href="mailto:sales@ccwequipment.com.au"
              className="mt-6 inline-block text-[14px] font-medium text-zinc-300 transition hover:text-sky-300"
            >
              sales@ccwequipment.com.au
            </a>
            <p className="mt-3 text-[12px] tracking-wide text-zinc-500">
              Brisbane · Sydney · Melbourne
            </p>
          </div>

          <FooterCol title="Product" links={PRODUCT} />
          <FooterCol title="Company" links={COMPANY} />
          <FooterCol title="Legal" links={LEGAL} />
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 border-t border-white/[0.06] py-6 text-[12px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} CCW Equipment Suppliers. All rights reserved.</p>
          <p className="tracking-wide" style={display}>
            Built for distributors · AU
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">{title}</p>
      <ul className="mt-5 space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group inline-flex items-center gap-1.5 text-[14px] text-zinc-400 transition-colors hover:text-white"
            >
              {l.label}
              <ArrowUpRight
                className="h-3 w-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-70"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
