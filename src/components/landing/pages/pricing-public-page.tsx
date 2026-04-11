import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { MarketingSectionHeading } from '@/components/landing/marketing-section-heading';
import { MarketingHeroBackdrop, PricingGlowPanel } from '@/components/landing/marketing-page-visuals';
import { marketingSectionRule, marketingSectionY, marketingShell } from '@/components/landing/marketing-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TIERS = [
  {
    name: 'Foundation',
    price: 'Tailored',
    description: 'For teams consolidating quotes, orders, and core catalog on one spine.',
    highlight: false,
    features: ['Quote-to-order workflows', 'Role-based access', 'Standard reporting', 'Email-based support'],
  },
  {
    name: 'Operations Plus',
    price: 'Tailored',
    description: 'For multi-branch distributors layering inventory depth and integration milestones.',
    highlight: true,
    features: [
      'Everything in Foundation',
      'Warehouse & transfer themes',
      'Integration roadmap (phased)',
      'Named success checkpoints',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Let’s scope it',
    description: 'For organisations that need governance, advanced rollout, and stakeholder alignment.',
    highlight: false,
    features: ['Security & compliance dialogue', 'Custom rollout plan', 'Executive visibility', 'Premium support options'],
  },
];

export function PricingPublicPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-16 pb-8 md:pt-24 md:pb-12">
        <MarketingHeroBackdrop />
        <PricingGlowPanel />
        <div className={cn(marketingShell, 'relative z-10 text-center')}>
          <p className="text-xs font-bold tracking-[0.22em] text-sky-400 uppercase drop-shadow-[0_0_20px_rgba(56,189,248,0.35)] sm:text-sm">
            Pricing
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-balance text-white sm:text-5xl md:text-[3rem] md:leading-[1.08]">
            Packaging that respects wholesale complexity
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-xl">
            We scope pricing to branches, SKUs, integrations, and support needs—so you are not forced into a generic seat
            matrix that ignores your operation.
          </p>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'relative bg-zinc-950/60')}>
        <div className={marketingShell}>
          <div className="grid gap-8 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={cn(
                  'relative flex flex-col overflow-hidden rounded-3xl border p-8 shadow-xl md:p-10',
                  tier.highlight
                    ? 'border-sky-500/40 bg-gradient-to-b from-sky-500/10 via-zinc-950/90 to-black ring-2 ring-sky-500/25'
                    : 'border-white/10 bg-gradient-to-b from-zinc-900/80 to-black ring-1 ring-white/5'
                )}
              >
                {tier.highlight ? (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500" />
                ) : null}
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white">{tier.name}</h2>
                  <p className="mt-3 text-4xl font-black tracking-tight text-white">{tier.price}</p>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">{tier.description}</p>
                </div>
                <ul className="grow space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-3 text-sm text-zinc-200">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    'mt-10 h-12 w-full rounded-xl font-semibold',
                    tier.highlight
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg hover:brightness-110'
                      : 'border border-white/15 bg-white/[0.06] text-white hover:bg-white/10'
                  )}
                  variant={tier.highlight ? 'default' : 'outline'}
                  asChild
                >
                  <Link href="/login">
                    {tier.highlight ? 'Get started' : 'Talk with us'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule)}>
        <div className={marketingShell}>
          <MarketingSectionHeading
            kicker="What drives price"
            title="Branches, SKUs, integrations, and support depth"
            description="Expect a conversation about your reality—not a self-serve checkout that pretends every distributor looks the same."
          />
          <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
            {[
              { title: 'Honest scoping', body: 'We align packaging to rollout phases so you pay for outcomes—not shelf-ware.' },
              { title: 'Integration cadence', body: 'Connectors come online when your data and ownership model are ready.' },
              { title: 'Training lift', body: 'Role paths reduce time-to-productivity versus one generic manual.' },
              { title: 'Governance needs', body: 'Enterprise expectations around access, audit, and visibility shape the plan.' },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left shadow-lg backdrop-blur-sm"
              >
                <h3 className="font-bold text-white">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-12 max-w-2xl text-center text-sm text-zinc-500">
            Figures on this page are illustrative tiers—not a public rate card. Final commercial terms are agreed with your
            stakeholders.
          </p>
        </div>
      </section>
    </>
  );
}
