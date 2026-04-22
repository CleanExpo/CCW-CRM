import type { ReactNode } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { MarketingPublicHero } from '@/components/landing/marketing-public-hero';
import { MarketingHeroBackdrop } from '@/components/landing/marketing-page-visuals';
import { marketingSectionRule, marketingSectionY, marketingShell } from '@/components/landing/marketing-shell';
import { cn } from '@/lib/utils';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/[0.09] bg-gradient-to-br from-zinc-900/85 via-zinc-950/90 to-black p-8 shadow-[0_20px_70px_-28px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.05] md:p-10">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-600/20 ring-1 ring-indigo-400/20">
          <FileText className="h-4 w-4 text-indigo-200" aria-hidden />
        </span>
        <h2 className="text-xl font-bold text-white md:text-2xl">{title}</h2>
      </div>
      <div className="space-y-4 text-sm leading-relaxed text-zinc-400 md:text-[15px]">{children}</div>
    </div>
  );
}

export function TermsPublicPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-16 pb-12 md:pt-24 md:pb-16">
        <MarketingHeroBackdrop />
        <div className={cn(marketingShell, 'relative z-10')}>
          <MarketingPublicHero
            kicker="Legal"
            title={
              <>
                Terms of <span className="text-transparent bg-gradient-to-r from-indigo-300 via-white to-sky-300 bg-clip-text">service</span>
              </>
            }
            description="Rules for accessing and using CCW Online ERP. Replace with counsel-approved terms for production; this outline matches the public marketing experience and common SaaS expectations."
          />
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'bg-zinc-950/50')}>
        <div className={cn(marketingShell, 'space-y-10')}>
          <Block title="Agreement">
            <p>
              By creating an account or using the service, you agree to these terms on behalf of yourself or the
              organisation you represent. If you do not agree, do not use the service.
            </p>
          </Block>

          <Block title="The service">
            <p>
              CCW Online ERP is a cloud operations platform for equipment suppliers and related workflows (for example
              catalog, quotes, orders, inventory themes, and integrations you enable). Features evolve; we may add,
              change, or retire functionality with reasonable notice where practicable.
            </p>
          </Block>

          <Block title="Accounts and acceptable use">
            <p>
              You are responsible for credentials, accurate registration data, and activity under your accounts. You
              must not misuse the service, attempt unauthorised access, interfere with other tenants, or use the
              platform in violation of law.
            </p>
          </Block>

          <Block title="Customer data">
            <p>
              You retain rights in data you submit. We process it to provide, secure, and improve the service as
              described in the{' '}
              <Link href="/privacy" className="font-medium text-sky-400 hover:underline">
                Privacy Policy
              </Link>
              . Integration data is subject to both these terms and the third-party services you connect.
            </p>
          </Block>

          <Block title="Disclaimers and limitation">
            <p>
              The service is provided on an &ldquo;as is&rdquo; basis to the extent permitted by law. Liability caps,
              indemnities, warranty disclaimers, and carve-outs for non-excludable consumer guarantees should be set by
              qualified counsel for your go-live contracts.
            </p>
          </Block>

          <Block title="Governing law">
            <p>
              These terms are intended to be governed by the laws of Australia. Courts in the State or Territory agreed
              in your order form—or otherwise Queensland—may have exclusive jurisdiction, subject to mandatory law.
            </p>
          </Block>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-transparent p-6 text-center text-sm text-zinc-400">
            <Link href="/privacy" className="font-semibold text-sky-300 hover:text-sky-200 hover:underline">
              ← Privacy policy
            </Link>
            <span className="mx-3 text-zinc-600">·</span>
            <a href="mailto:sales@ccwequipment.com.au" className="font-semibold text-sky-300 hover:text-sky-200 hover:underline">
              Contact sales
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
