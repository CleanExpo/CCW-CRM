import Link from 'next/link';
import { Layers3, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { marketingShell, marketingSectionRule } from '@/components/landing/marketing-shell';

const PRODUCT = [
  { href: '/product', label: 'Overview' },
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How it works' },
];

const COMPANY = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/login', label: 'Sign in' },
];

const LEGAL = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export function MarketingFooter() {
  return (
    <footer className={cn(marketingSectionRule, 'relative border-white/[0.08] bg-zinc-950/90')}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent"
        aria-hidden
      />
      <div className={cn(marketingShell, 'py-14 md:py-16')}>
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
                <Layers3 className="h-5 w-5 text-white" />
              </span>
              <span className="text-lg font-bold tracking-tight text-white">CCW Online ERP</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
              One operational spine for quotes, inventory, and fulfilment—built for equipment
              wholesalers who run on SKUs, not slides.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Product</p>
            <ul className="mt-4 space-y-3 text-sm">
              {PRODUCT.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-zinc-400 transition-colors hover:text-sky-300"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Company</p>
            <ul className="mt-4 space-y-3 text-sm">
              {COMPANY.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-zinc-400 transition-colors hover:text-sky-300"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Legal</p>
            <ul className="mt-4 space-y-3 text-sm">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-zinc-400 transition-colors hover:text-sky-300">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Connect</p>
            <a
              href="mailto:sales@ccwequipment.com.au"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-300/95 transition-colors hover:text-sky-200"
            >
              <Mail className="h-4 w-4 shrink-0 opacity-80" />
              sales@ccwequipment.com.au
            </a>
            <p className="mt-6 text-xs leading-relaxed text-zinc-600">
              Brisbane · Sydney · Melbourne
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 text-xs text-zinc-600 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} CCW Equipment Suppliers. All rights reserved.</p>
          <p className="text-center sm:text-right">Professional operations software for distributors.</p>
        </div>
      </div>
    </footer>
  );
}
