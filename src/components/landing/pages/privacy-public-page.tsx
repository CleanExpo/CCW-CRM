import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, Mail, Shield } from 'lucide-react';
import { MarketingPublicHero } from '@/components/landing/marketing-public-hero';
import { MarketingHeroBackdrop } from '@/components/landing/marketing-page-visuals';
import { marketingSectionRule, marketingSectionY, marketingShell } from '@/components/landing/marketing-shell';
import { cn } from '@/lib/utils';

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-3xl border border-white/[0.09] bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-black p-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.05] md:p-10"
    >
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-600/20 ring-1 ring-sky-500/25">
          <Shield className="h-4 w-4 text-sky-300" aria-hidden />
        </span>
        <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">{title}</h2>
      </div>
      <div className="space-y-4 text-sm leading-relaxed text-zinc-400 md:text-[15px]">{children}</div>
    </section>
  );
}

export function PrivacyPublicPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-16 pb-12 md:pt-24 md:pb-16">
        <MarketingHeroBackdrop />
        <div className={cn(marketingShell, 'relative z-10')}>
          <MarketingPublicHero
            kicker="Privacy"
            title={
              <>
                Privacy <span className="text-transparent bg-gradient-to-r from-sky-300 via-white to-indigo-300 bg-clip-text">policy</span>
              </>
            }
            description="How CCW Online collects, uses, stores, and shares personal information in connection with our ERP and related services. This page is provided for transparency; wording should be reviewed by qualified legal counsel before go-live."
          />
          <div
            className={cn(
              'mx-auto mt-10 flex max-w-3xl gap-3 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-zinc-900/60 to-zinc-950/80 p-4 text-sm text-amber-100/90 ring-1 ring-amber-500/15',
              'md:items-center'
            )}
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400/90" aria-hidden />
            <p>
              <strong className="font-semibold text-amber-50">Draft notice.</strong> Operational detail below reflects
              architecture intent (processors, retention themes, rights channel). Replace placeholders (for example ABN)
              and obtain legal sign-off before publishing as final policy.
            </p>
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'bg-zinc-950/50')}>
        <div className={cn(marketingShell, 'space-y-10')}>
          <Section id="controller" title="Who controls your data">
            <p>
              The data controller is <strong className="text-zinc-200">CCW Equipment Suppliers</strong> (Australia),
              operating CCW Online ERP. Contact for privacy requests:{' '}
              <a href="mailto:privacy@ccwequipment.com.au" className="font-medium text-sky-400 underline-offset-2 hover:underline">
                privacy@ccwequipment.com.au
              </a>
              . Commercial enquiries remain welcome at{' '}
              <a href="mailto:sales@ccwequipment.com.au" className="font-medium text-sky-400 underline-offset-2 hover:underline">
                sales@ccwequipment.com.au
              </a>
              .
            </p>
            <p>
              Where an ABN or registered entity name must appear on the public policy for your deployment, insert the
              verified legal entity and identifier in your production build.
            </p>
          </Section>

          <Section id="collected" title="Information we may collect">
            <ul className="list-inside list-disc space-y-2 marker:text-sky-500/80">
              <li>Account details such as name, email, role, and tenant identifiers used to operate the service.</li>
              <li>Business transaction data you enter or sync (orders, quotes, inventory, customers, suppliers).</li>
              <li>
                Technical and security metadata (for example device or browser characteristics, IP-derived region, auth
                events) to protect accounts and diagnose issues.
              </li>
              <li>
                Optional product analytics where enabled—governed by consent mechanisms when required (see roadmap in
                internal privacy architecture docs).
              </li>
            </ul>
          </Section>

          <Section id="processors" title="Processors and sub-processors">
            <p>
              Depending on your configuration, data may be processed by infrastructure and integration partners
              including, without limitation:{' '}
              <strong className="text-zinc-200">Supabase</strong> (database and auth),{' '}
              <strong className="text-zinc-200">Anthropic</strong> (where AI Boardroom or similar features send prompts
              containing business metrics you choose to include), <strong className="text-zinc-200">Stripe</strong>{' '}
              (billing), and connectors such as <strong className="text-zinc-200">Cin7</strong> or{' '}
              <strong className="text-zinc-200">Xero</strong> when you connect them. Only connect integrations you
              authorise; each vendor maintains its own terms and privacy notices.
            </p>
          </Section>

          <Section id="retention" title="Retention">
            <p>
              Retention follows operational and legal needs. Illustrative targets used in architecture planning: active
              account data for the life of the subscription; financial transaction records aligned with Australian Tax
              Office record-keeping expectations (often up to seven years); security logs on shorter rolling windows;
              integration debug logs on shorter horizons. Exact schedules should be enforced in your production data
              layer and documented after legal review.
            </p>
          </Section>

          <Section id="rights" title="Your rights">
            <p>
              Subject to applicable Australian privacy law, you may request access to, or correction of, personal
              information we hold. Deletion may be limited where law or legitimate business records require retention.
              Contact <strong className="text-zinc-200">privacy@ccwequipment.com.au</strong> with your tenant name and a
              description of the request.
            </p>
          </Section>

          <Section id="breach" title="Notifiable data breaches">
            <p>
              Where a breach is likely to result in serious harm and meets statutory thresholds, we will follow the
              Australian Notifiable Data Breach scheme: assess, contain, notify the OAIC and affected individuals when
              required, and document the incident. Individuals may also complain to the Office of the Australian
              Information Commissioner (OAIC).
            </p>
          </Section>

          <Section id="ai" title="AI transparency">
            <p>
              Where AI-assisted features are enabled, business metrics or text you submit may be sent to model providers
              (for example Anthropic) to generate in-product recommendations. Configure features and data shared in line
              with your governance policy. A dedicated in-product notice may appear near AI surfaces; this section
              supplements that experience.
            </p>
          </Section>

          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center md:flex-row md:text-left">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 shrink-0 text-sky-400/90" aria-hidden />
              <p className="text-sm text-zinc-400">
                Questions about this policy? Email{' '}
                <a href="mailto:privacy@ccwequipment.com.au" className="font-medium text-sky-400 hover:underline">
                  privacy@ccwequipment.com.au
                </a>
                .
              </p>
            </div>
            <Link href="/terms" className="text-sm font-semibold text-sky-300 hover:text-sky-200 hover:underline">
              Terms of service →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
