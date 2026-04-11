import {
  MARKETING_SECTION_RULE,
  MARKETING_SHELL,
} from '@/components/marketing/marketing-constants';
import { MARKETING_PRIMARY_NAV } from '@/components/marketing/marketing-nav';
import { cn } from '@/lib/utils';
import { Layers3 } from 'lucide-react';
import Link from 'next/link';

export function MarketingSiteFooter() {
  return (
    <footer className={cn(MARKETING_SECTION_RULE, 'border-white/[0.08] bg-zinc-950/80')}>
      <div className={cn(MARKETING_SHELL, 'py-14 md:py-16')}>
        <div className="grid gap-10 border-b border-white/[0.08] pb-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <Layers3 className="h-6 w-6 text-sky-400" />
              <span className="text-lg font-bold text-white">CCW Online ERP</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
              Operations platform for equipment wholesalers—quotes, inventory, fulfilment, and
              finance in one spine.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-3">
            <div>
              <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Product</p>
              <ul className="mt-4 space-y-2.5 text-sm font-medium text-zinc-300">
                <li>
                  <Link href="/platform" className="transition-colors hover:text-white">
                    Platform
                  </Link>
                </li>
                <li>
                  <Link href="/integrations" className="transition-colors hover:text-white">
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="transition-colors hover:text-white">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Company</p>
              <ul className="mt-4 space-y-2.5 text-sm font-medium text-zinc-300">
                <li>
                  <Link href="/about" className="transition-colors hover:text-white">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="transition-colors hover:text-white">
                    Trust &amp; security
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition-colors hover:text-white">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Resources</p>
              <ul className="mt-4 space-y-2.5 text-sm font-medium text-zinc-300">
                <li>
                  <Link href="/faq" className="transition-colors hover:text-white">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/#signin" className="transition-colors hover:text-white">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/portal/orders" className="transition-colors hover:text-white">
                    Customer portal
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-sm text-zinc-500 sm:flex-row">
          <p className="text-center sm:text-left">
            &copy; {new Date().getFullYear()} CCW Equipment Suppliers. Brisbane · Sydney · Melbourne
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            {MARKETING_PRIMARY_NAV.map(({ href, label }) => (
              <Link key={href} href={href} className="transition-colors hover:text-zinc-300">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
