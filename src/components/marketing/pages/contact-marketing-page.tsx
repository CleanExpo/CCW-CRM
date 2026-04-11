import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { MarketingHeroBackdrop } from '@/components/landing/marketing-page-visuals';
import { marketingShell } from '@/components/landing/marketing-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Lightweight contact surface — not linked from simplified global nav. */
export function ContactMarketingPage() {
  return (
    <section className="relative overflow-hidden pt-20 pb-28 md:pt-28 md:pb-36">
      <MarketingHeroBackdrop />
      <div className={cn(marketingShell, 'relative z-10 mx-auto max-w-2xl text-center')}>
        <p className="text-xs font-bold tracking-[0.22em] text-sky-400 uppercase">Contact</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
          Talk about branches, SKUs, and rollout
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-300">
          Share your context and we will align on scope—same operational spine as the rest of the public site.
        </p>
        <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-950/80 p-8 shadow-2xl ring-1 ring-white/10 md:p-10">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/15">
            <Mail className="h-7 w-7 text-sky-200" strokeWidth={2} />
          </div>
          <p className="text-sm leading-relaxed text-zinc-400">
            Prefer email for first contact—replace with your production address when ready.
          </p>
          <Button
            className="mt-8 h-12 w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 font-semibold text-white shadow-lg md:w-auto md:px-10"
            asChild
          >
            <a href="mailto:sales@ccwequipment.com.au">
              Email sales
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <p className="mt-6 text-xs text-zinc-500">
            Already a customer?{' '}
            <Link href="/login" className="font-medium text-sky-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
