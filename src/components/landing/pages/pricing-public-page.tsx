import Link from 'next/link';
import { ArrowRight, Check, HelpCircle, RefreshCw, Sparkles } from 'lucide-react';
import { MarketingSectionHeading } from '@/components/landing/marketing-section-heading';
import { MarketingPublicHero } from '@/components/landing/marketing-public-hero';
import { MarketingHeroBackdrop, PricingGlowPanel } from '@/components/landing/marketing-page-visuals';
import { marketingSectionRule, marketingSectionY, marketingShell } from '@/components/landing/marketing-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const INCLUDED_EVERYWHERE = [
  'Secure sign-in & tenant-aware routing',
  'Core product & customer records',
  'Quote and order objects on one spine',
  'Documentation-aligned onboarding paths',
  'Access to implementation roadmap dialogue',
];

const FAQ_PRICING = [
  {
    q: 'Do you publish a per-seat price?',
    a: 'Not as a one-size grid. Wholesale operations vary too widely; we scope to branches, SKUs, and integration depth.',
    icon: HelpCircle,
  },
  {
    q: 'Can we start smaller and expand?',
    a: 'Yes—many teams begin with quote-to-order and catalog hygiene, then add warehouse and finance depth.',
    icon: RefreshCw,
  },
  {
    q: 'What about AI or premium support?',
    a: 'Packaged where it matches your governance needs; discussed explicitly during scoping—not hidden fees later.',
    icon: Sparkles,
  },
];

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
        <div className={cn(marketingShell, 'relative z-10')}>
          <MarketingPublicHero
            kicker="Pricing"
            title={
              <>
                Packaging that respects{' '}
                <span className="text-transparent bg-gradient-to-r from-emerald-200 via-white to-sky-200 bg-clip-text">
                  wholesale complexity
                </span>
              </>
            }
            description="We scope pricing to branches, SKUs, integrations, and support needs—so you are not forced into a generic seat matrix that ignores your operation."
          />
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

      <section className={cn(marketingSectionY, marketingSectionRule, 'bg-zinc-950/50')}>
        <div className={marketingShell}>
          <MarketingSectionHeading
            kicker="Every tier"
            title="What we typically include across packages"
            description="Exact entitlements are confirmed in commercial conversations—these themes stay consistent so you are not nickel-and-dimed for basics."
          />
          <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-xl md:p-10">
            <ul className="grid gap-4 sm:grid-cols-2">
              {INCLUDED_EVERYWHERE.map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-zinc-200">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90" />
                  {line}
                </li>
              ))}
            </ul>
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
          <p className="mx-auto mt-12 max-w-2xl text-center text-sm text-zinc-400">
            Figures on this page are illustrative tiers—not a public rate card. Final commercial terms are agreed with your
            stakeholders.
          </p>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'bg-zinc-950/40')}>
        <div className={marketingShell}>
          <MarketingSectionHeading
            kicker="Commercial cadence"
            title="How conversations usually run"
            description="Transparent phases beat surprise invoices—your finance team should recognise the pattern."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Discovery call',
                body: 'Align on branches, volumes, integrations, and success criteria before numbers land on paper.',
              },
              {
                title: 'Proposal & assumptions',
                body: 'Written scope with explicit inclusions, optional phases, and what “done” means per milestone.',
              },
              {
                title: 'Annual alignment',
                body: 'Review packaging as you add sites, SKUs, or connector depth—so growth does not break predictability.',
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black p-7 text-left shadow-md"
              >
                <h3 className="font-bold text-white">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule)}>
        <div className={marketingShell}>
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">Pricing questions</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {FAQ_PRICING.map(({ q, a, icon: Icon }) => (
              <div
                key={q}
                className="rounded-2xl border border-white/[0.08] bg-black/40 p-6 shadow-lg backdrop-blur-sm"
              >
                <Icon className="h-6 w-6 text-sky-400" strokeWidth={2} />
                <h3 className="mt-4 text-base font-bold text-white">{q}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-wrap justify-center gap-4">
            <Button className="h-12 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-8 font-semibold text-white" asChild>
              <Link href="/features">Explore features</Link>
            </Button>
            <Button variant="outline" className="h-12 rounded-xl border-white/15 bg-white/[0.04] text-white" asChild>
              <Link href="/how-it-works">How rollout works</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
