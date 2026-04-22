import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { MarketingHeroBackdrop } from '@/components/landing/marketing-page-visuals';
import { MarketingPublicHero } from '@/components/landing/marketing-public-hero';
import { marketingShell } from '@/components/landing/marketing-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Lightweight contact surface — matches other marketing routes. */
export function ContactMarketingPage() {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
      <MarketingHeroBackdrop />
      <div className={cn(marketingShell, 'relative z-10 mx-auto max-w-2xl')}>
        <MarketingPublicHero
          kicker="Contact"
          title={
            <>
              Talk about branches, SKUs, and{' '}
              <span className="text-transparent bg-gradient-to-r from-sky-200 via-white to-indigo-200 bg-clip-text">
                rollout
              </span>
            </>
          }
          description="Share your context and we will align on scope—same operational spine as the rest of the public site."
        />
        <div className="mt-10 rounded-[1.35rem] bg-gradient-to-br from-sky-500/35 via-white/15 to-indigo-600/35 p-px shadow-[0_32px_100px_-28px_rgba(56,189,248,0.25)]">
          <div className="rounded-[1.3rem] border border-white/[0.08] bg-zinc-950/90 p-8 backdrop-blur-sm md:p-10">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/25 to-indigo-600/20 ring-1 ring-sky-400/30">
                <Mail className="h-7 w-7 text-sky-100" strokeWidth={2} />
              </div>
              <p className="text-center text-sm leading-relaxed text-zinc-400">
                Prefer email for first contact—replace with your production address when ready.
              </p>
              <div className="mt-8 flex justify-center">
                <Button
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 font-semibold text-white shadow-lg shadow-sky-500/20 md:w-auto md:px-10"
                  asChild
                >
                  <a href="mailto:sales@ccwequipment.com.au">
                    Email sales
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="mt-6 text-center text-xs text-zinc-500">
                Already a customer?{' '}
                <Link href="/login" className="font-medium text-sky-400 hover:underline">
                  Log in
                </Link>
              </p>
          </div>
        </div>
      </div>
    </section>
  );
}
