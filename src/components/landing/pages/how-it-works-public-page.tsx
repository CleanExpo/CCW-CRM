import Link from 'next/link';
import { ArrowRight, CalendarClock, CheckCircle2, MessageSquare, Shield } from 'lucide-react';
import { MarketingSectionHeading } from '@/components/landing/marketing-section-heading';
import { MarketingPublicHero } from '@/components/landing/marketing-public-hero';
import { MarketingHeroBackdrop, RolloutPathGraphic, UiMockupStrip } from '@/components/landing/marketing-page-visuals';
import { marketingSectionRule, marketingSectionY, marketingShell } from '@/components/landing/marketing-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRINCIPLES = [
  {
    title: 'No forced big-bang',
    body: 'Prove quote-to-order value first, then widen inventory and integrations when data ownership is clear.',
    icon: Shield,
  },
  {
    title: 'Branch reality first',
    body: 'Workflows reflect how your sites actually operate—not a theoretical “best practice” chart from a slide.',
    icon: MessageSquare,
  },
  {
    title: 'Time-boxed milestones',
    body: 'Each phase ends with demos and checkpoints so leadership stays aligned and teams know what “done” means.',
    icon: CalendarClock,
  },
];

const FIRST_PHASES = [
  { window: 'Weeks 1–2', label: 'Discovery & alignment', detail: 'Map quotes, branches, and hand-offs you already run.' },
  { window: 'Weeks 3–6', label: 'Core workflows live', detail: 'Catalog hygiene, quotes, and orders on one spine.' },
  { window: 'Weeks 7–12', label: 'Depth & integrations', detail: 'Layer inventory themes and connector milestones by priority.' },
];

const STEPS = [
  {
    step: '01',
    title: 'Map your workflows',
    body: 'Align quotes, fulfilment, and finance with how your branches already run—no forced rip-and-replace fantasy.',
    points: ['Discovery workshops', 'Branch-specific nuances', 'Success criteria defined'],
  },
  {
    step: '02',
    title: 'Connect the stack',
    body: 'Bring inventory, accounting, and commerce signals into one place so decisions use current reality.',
    points: ['Phased connectors', 'Data ownership clarity', 'Rollback-friendly milestones'],
  },
  {
    step: '03',
    title: 'Train by role',
    body: 'Equip sales, warehouse, finance, and service with paths that respect day-one jobs.',
    points: ['Role quick-starts', 'In-app patterns', 'Leadership visibility'],
  },
  {
    step: '04',
    title: 'Operate with confidence',
    body: 'Dashboards, alerts, and runbooks help you catch issues early and keep honesty at the top.',
    points: ['Operational KPIs', 'Alerting discipline', 'Continuous improvement loop'],
  },
];

export function HowItWorksPublicPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-16 pb-12 md:pt-24 md:pb-20">
        <MarketingHeroBackdrop />
        <div className={cn(marketingShell, 'relative z-10')}>
          <div className="mx-auto max-w-3xl">
            <MarketingPublicHero
              kicker="How it works"
              title={
                <>
                  A disciplined rollout—
                  <span className="text-transparent bg-gradient-to-r from-sky-200 via-zinc-100 to-violet-200 bg-clip-text">
                    not a miracle weekend
                  </span>
                </>
              }
              description="CCW Online ERP is designed to land in phases your team can absorb: prove value early, then deepen inventory, integrations, and governance as trust grows."
            />
          </div>
          <div className="mx-auto mt-12 max-w-4xl opacity-90">
            <RolloutPathGraphic />
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'bg-zinc-950/60')}>
        <div className={marketingShell}>
          <MarketingSectionHeading
            kicker="Principles"
            title="How we keep rollouts honest"
            description="Discipline beats heroics—your operators already have day jobs, so the plan respects attention spans and cash flow."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PRINCIPLES.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-black p-8 shadow-xl ring-1 ring-white/[0.04]"
              >
                <div className="mb-4 inline-flex rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                  <Icon className="h-6 w-6 text-sky-200" strokeWidth={2} />
                </div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule)}>
        <div className={marketingShell}>
          <MarketingSectionHeading
            kicker="Early momentum"
            title="What the first ~90 days often look like"
            description="Timelines vary by branches and integrations—these bands are illustrative, not a fixed contract."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {FIRST_PHASES.map((p) => (
              <div
                key={p.label}
                className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-zinc-950 p-6 text-left shadow-lg"
              >
                <p className="text-xs font-bold tracking-wider text-sky-400 uppercase">{p.window}</p>
                <h3 className="mt-2 text-lg font-bold text-white">{p.label}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'bg-zinc-950/40')}>
        <div className={marketingShell}>
          <MarketingSectionHeading
            kicker="Rollout model"
            title="Four beats your organisation can actually execute"
            description="Each phase has clear outcomes—so you are never stuck in a multi-year science project."
          />
          <div className="mt-16 space-y-10">
            {STEPS.map((s, index) => (
              <div
                key={s.step}
                className={cn(
                  'relative flex flex-col gap-8 rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-black p-8 shadow-xl md:flex-row md:items-center md:gap-12 md:p-10 lg:p-12',
                  index % 2 === 1 && 'md:flex-row-reverse'
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="text-5xl font-black leading-none text-sky-500/80 tabular-nums md:text-6xl">{s.step}</span>
                  <h2 className="mt-4 text-2xl font-bold text-white md:text-3xl">{s.title}</h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-300 md:text-lg">{s.body}</p>
                  <ul className="mt-6 space-y-3">
                    {s.points.map((p) => (
                      <li key={p} className="flex items-center gap-3 text-sm font-medium text-zinc-200 md:text-base">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-sky-400" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative flex min-w-0 flex-1 items-center justify-center">
                  <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.08),transparent_65%)]" />
                  <UiMockupStrip
                    className={cn('relative z-10 w-full max-w-md shadow-2xl', index % 2 === 0 ? 'rotate-1' : '-rotate-1')}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'border-white/[0.06]')}>
        <div className={cn(marketingShell, 'grid gap-10 lg:grid-cols-2 lg:items-center')}>
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-sky-400 uppercase">Governance</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Steering that does not vanish after kick-off
            </h2>
            <p className="mt-4 text-zinc-400">
              We expect recurring reviews with your project sponsor—so priorities stay visible when the next urgent
              shipment lands.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-300">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                Weekly or fortnightly checkpoint options during active build-out.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                Clear owners for data migration vs change management vs integration.
              </li>
            </ul>
          </div>
          <UiMockupStrip className="mx-auto max-w-md shadow-2xl lg:ml-auto" />
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule)}>
        <div className={cn(marketingShell, 'text-center')}>
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">Ready when your team is</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-300">
            Log in to your workspace, or continue exploring features and pricing—same design language, same operational
            spine.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              className="h-14 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-10 text-base font-semibold text-white shadow-xl hover:brightness-110"
              asChild
            >
              <Link href="/login">
                Log in
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 rounded-xl border-white/15 bg-white/[0.04] px-10 text-base font-semibold text-white"
              asChild
            >
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
