/**
 * Premium marketing home — server component.
 * Hero LCP text stays outside client reveal wrappers.
 */
import { marketingFont } from '@/components/landing/marketing-font';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { MarketingHeader } from '@/components/landing/marketing-header';
import { MarketingLoginPanel } from '@/components/landing/marketing-login-panel';
import { MarketingReveal } from '@/components/landing/marketing-reveal';
import { MarketingSectionHeading } from '@/components/landing/marketing-section-heading';
import {
  marketingSectionRule as sectionRule,
  marketingSectionY as sectionY,
  marketingShell as shell,
  marketingShellWide as shellWide,
} from '@/components/landing/marketing-shell';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';

const MarketingAmbientCanvas = dynamic(
  () => import('@/components/landing/marketing-ambient').then((m) => m.MarketingAmbientCanvas),
  { loading: () => null }
);

const HeroOperationsStage = dynamic(
  () => import('@/components/landing/hero-operations-stage').then((m) => m.HeroOperationsStage),
  {
    loading: () => (
      <div className="min-h-[320px] w-full border border-white/[0.06] bg-[#0a0a0e]" aria-hidden />
    ),
  }
);

const LandingFaq = dynamic(
  () => import('@/components/landing/landing-faq').then((m) => m.LandingFaq),
  {
    loading: () => <div className="min-h-[200px] w-full" aria-hidden />,
  }
);

const display: React.CSSProperties = {
  fontFamily: 'var(--font-marketing-display), var(--font-marketing-body), sans-serif',
};

const FRICTIONS = [
  {
    n: '01',
    title: 'Spreadsheets as system of record',
    body: 'Orders, stock, and customer context live in files nobody trusts after lunch.',
  },
  {
    n: '02',
    title: 'Tools that ignore the floor',
    body: 'Generic CRM never learned quotes, branches, receiving, or finance hand-offs.',
  },
  {
    n: '03',
    title: 'Integrations that almost sync',
    body: 'Inventory, accounting, and commerce drift until every meeting becomes reconciliation.',
  },
];

const CAPABILITIES = [
  {
    n: '01',
    title: 'Quote to cash, one thread',
    body: 'Quotes, orders, and fulfilment status stay linked—so sales, warehouse, and finance stop arguing about which file is real.',
    points: ['Guided quoting', 'Order conversion', 'Margin you can explain'],
  },
  {
    n: '02',
    title: 'Inventory built for distributors',
    body: 'Stock, transfers, purchase orders, and receiving that match how goods actually move across Australian branches.',
    points: ['Branch visibility', 'Transfers & alerts', 'Procurement flow'],
  },
  {
    n: '03',
    title: 'Finance hand-offs without theatre',
    body: 'Invoices and reconciliation themes designed to land in accounting—connectors as a roadmap, not a footnote.',
    points: ['Audit-minded trails', 'Xero-ready path', 'Clear cutovers'],
  },
  {
    n: '04',
    title: 'Assist where work already happens',
    body: 'Embedded help inside quotes, inventory, and service—not a disconnected chat novelty.',
    points: ['In-context assists', 'Role-aware training', 'Governance first'],
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Map the work',
    body: 'Align quotes, fulfilment, and finance to how your branches already run.',
  },
  {
    n: '02',
    title: 'Connect the stack',
    body: 'Bring inventory, accounting, and commerce into one operational picture.',
  },
  {
    n: '03',
    title: 'Train by role',
    body: 'Sales, warehouse, finance, and service each get a path that respects day-one jobs.',
  },
  {
    n: '04',
    title: 'Operate with clarity',
    body: 'Dashboards and runbooks that keep leadership visibility honest.',
  },
];

export interface MarketingLandingProps {
  statsSlot: ReactNode;
}

export default function MarketingLanding({ statsSlot }: MarketingLandingProps) {
  return (
    <div
      className={cn(
        marketingFont.className,
        'dark relative min-h-screen scroll-smooth bg-[#050508] text-zinc-100 antialiased selection:bg-sky-500/25 selection:text-white'
      )}
    >
      <MarketingAmbientCanvas />
      <div className="relative z-10">
        <MarketingHeader />
        <main>
          {/* ─── HERO ─── */}
          <section className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(14,165,233,0.12),transparent_55%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                backgroundSize: '72px 72px',
                maskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, black, transparent 75%)',
              }}
              aria-hidden
            />

            <div
              className={cn(shellWide, 'relative pt-12 pb-12 md:pt-16 md:pb-16 lg:pt-20 lg:pb-20')}
            >
              <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] lg:gap-12 xl:gap-14">
                <div className="max-w-xl lg:pt-2">
                  <p
                    className="text-[11px] font-semibold tracking-[0.28em] text-sky-400/90 uppercase sm:text-xs"
                    style={display}
                  >
                    CCW Online
                  </p>

                  <h1
                    className="mt-4 text-[clamp(2.1rem,4.6vw,3.65rem)] leading-[1.02] font-semibold tracking-tight text-white"
                    style={display}
                  >
                    Operations software for equipment suppliers
                  </h1>

                  <p className="mt-5 text-base leading-relaxed text-zinc-400 md:text-lg">
                    Quotes, stock, and fulfilment in one system—built for Australian wholesalers who
                    move real SKUs, not slides.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Link
                      href="/login"
                      className="inline-flex h-12 items-center justify-center bg-sky-500 px-7 text-[15px] font-semibold text-zinc-950 transition hover:bg-sky-400"
                    >
                      Enter workspace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                    <Link
                      href="/product"
                      className="inline-flex h-12 items-center justify-center border border-white/20 px-7 text-[15px] font-semibold text-white transition hover:bg-white/[0.06]"
                    >
                      See the product
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {/* Dominant product plane — shares the first viewport on large screens */}
                <div className="min-w-0 lg:-mr-2 xl:-mr-4">
                  <HeroOperationsStage />
                </div>
              </div>
            </div>
          </section>

          {statsSlot}

          {/* ─── FRICTION ─── */}
          <section id="problems" className={cn(sectionY, sectionRule)}>
            <div className={shell}>
              <MarketingReveal>
                <div className="grid gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
                  <MarketingSectionHeading
                    index="01 — Pressure"
                    title="Your team isn’t slow. Your systems are noisy."
                    description="Equipment suppliers win on delivery dates, trust, and margin. None of that survives when every department keeps its own shadow copy of the truth."
                  />
                  <ol className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
                    {FRICTIONS.map((item) => (
                      <li
                        key={item.n}
                        className="grid grid-cols-[3rem_1fr] gap-4 py-7 md:grid-cols-[4rem_1fr] md:gap-8"
                      >
                        <span
                          className="text-2xl font-semibold text-zinc-600 tabular-nums md:text-3xl"
                          style={display}
                        >
                          {item.n}
                        </span>
                        <div>
                          <h3
                            className="text-lg font-semibold text-white md:text-xl"
                            style={display}
                          >
                            {item.title}
                          </h3>
                          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-zinc-400">
                            {item.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </MarketingReveal>
            </div>
          </section>

          {/* ─── SYSTEM ─── */}
          <section id="solution" className={cn(sectionY, sectionRule, 'relative bg-[#08080c]')}>
            <div className={shell}>
              <MarketingReveal>
                <MarketingSectionHeading
                  index="02 — System"
                  title="One operational spine—not another silo"
                  description="CCW Online unifies catalog, customers, quotes, orders, and warehouse work while leaving room for Cin7, Xero, and Shopify—so leadership sees one coherent picture."
                />
              </MarketingReveal>

              <MarketingReveal delayMs={80}>
                <div className="mt-14 grid gap-px overflow-hidden border border-white/[0.06] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Sales', detail: 'Quotes & conversion' },
                    { label: 'Warehouse', detail: 'Stock & transfers' },
                    { label: 'Finance', detail: 'Invoices & trails' },
                    { label: 'Service', detail: 'Customer history' },
                  ].map((cell) => (
                    <div
                      key={cell.label}
                      className="bg-[#08080c] px-6 py-8 transition-colors hover:bg-[#0c0c12]"
                    >
                      <p className="text-[12px] font-semibold tracking-[0.16em] text-sky-400/80 uppercase">
                        {cell.label}
                      </p>
                      <p className="mt-3 text-xl font-semibold text-white" style={display}>
                        {cell.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </MarketingReveal>

              <MarketingReveal delayMs={120}>
                <p className="mt-10 max-w-2xl text-sm leading-relaxed text-zinc-500">
                  Designed for Australian wholesale operations—confirm hosting, retention, and
                  compliance with your rollout team before go-live.
                </p>
              </MarketingReveal>
            </div>
          </section>

          {/* ─── CAPABILITIES ─── */}
          <section id="features" className={cn(sectionY, sectionRule)}>
            <div className={shell}>
              <MarketingReveal>
                <MarketingSectionHeading
                  index="03 — Capabilities"
                  title="What the floor and front office actually fight about"
                  description="Start where the pain is loudest. Expand when the team is ready—not when a vendor forces a big-bang cutover."
                />
              </MarketingReveal>

              <div className="mt-16 space-y-0 border-t border-white/[0.06]">
                {CAPABILITIES.map((cap, i) => (
                  <MarketingReveal key={cap.n} delayMs={i * 40}>
                    <article className="grid gap-6 border-b border-white/[0.06] py-10 md:grid-cols-[5rem_1fr_auto] md:gap-10 md:py-12">
                      <span
                        className="text-3xl font-semibold text-zinc-700 tabular-nums"
                        style={display}
                      >
                        {cap.n}
                      </span>
                      <div className="max-w-xl">
                        <h3
                          className="text-xl font-semibold text-white md:text-2xl"
                          style={display}
                        >
                          {cap.title}
                        </h3>
                        <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">{cap.body}</p>
                        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-zinc-500">
                          {cap.points.map((p) => (
                            <li key={p} className="flex items-center gap-2">
                              <span className="h-px w-3 bg-sky-500/70" aria-hidden />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="hidden items-start md:flex">
                        <Link
                          href="/features"
                          className="inline-flex items-center gap-1 text-[13px] font-medium text-zinc-400 transition hover:text-sky-300"
                        >
                          Details
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </article>
                  </MarketingReveal>
                ))}
              </div>
            </div>
          </section>

          {/* ─── ROLLOUT ─── */}
          <section id="how" className={cn(sectionY, sectionRule, 'bg-[#08080c]')}>
            <div className={shell}>
              <MarketingReveal>
                <MarketingSectionHeading
                  index="04 — Rollout"
                  title="A disciplined path—not a miracle weekend"
                  description="Four stages. Same spine. No theatre."
                />
              </MarketingReveal>

              <div className="relative mt-16">
                <div
                  className="pointer-events-none absolute top-0 bottom-0 left-[1.15rem] w-px bg-gradient-to-b from-sky-500/50 via-white/10 to-transparent md:left-[1.35rem]"
                  aria-hidden
                />
                <ol className="space-y-10 md:space-y-12">
                  {STEPS.map((step, i) => (
                    <MarketingReveal
                      key={step.n}
                      as="li"
                      delayMs={i * 50}
                      className="relative grid gap-4 pl-12 md:grid-cols-[8rem_1fr] md:gap-10 md:pl-16"
                    >
                      <span
                        className="absolute top-1 left-0 flex h-9 w-9 items-center justify-center border border-sky-500/40 bg-[#08080c] text-[12px] font-semibold text-sky-300 tabular-nums"
                        style={display}
                      >
                        {step.n}
                      </span>
                      <h3 className="text-lg font-semibold text-white md:text-xl" style={display}>
                        {step.title}
                      </h3>
                      <p className="max-w-lg text-[15px] leading-relaxed text-zinc-400">
                        {step.body}
                      </p>
                    </MarketingReveal>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {/* ─── OUTCOMES ─── */}
          <section className={cn(sectionY, sectionRule)}>
            <div className={shell}>
              <MarketingReveal>
                <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-end lg:gap-20">
                  <MarketingSectionHeading
                    index="05 — Outcomes"
                    title="Built for operators who measure work, not slides"
                  />
                  <blockquote className="border-l-2 border-sky-500/60 pl-6 md:pl-8">
                    <p
                      className="text-xl leading-snug font-medium text-zinc-100 md:text-2xl md:leading-snug"
                      style={display}
                    >
                      “The win isn’t more features—it’s fewer places to look when a customer asks
                      about a delivery date or a back-order.”
                    </p>
                    <footer className="mt-5 text-sm text-zinc-500">
                      Pattern from multi-branch wholesale operations · illustrative
                    </footer>
                  </blockquote>
                </div>
              </MarketingReveal>

              <MarketingReveal delayMs={80}>
                <dl className="mt-16 grid gap-px overflow-hidden border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3">
                  {[
                    { k: 'One spine', v: 'Quotes · stock · fulfilment' },
                    { k: 'AU-ready', v: 'Built for local wholesale ops' },
                    { k: 'Integrations', v: 'Cin7 · Xero · Shopify path' },
                  ].map((item) => (
                    <div key={item.k} className="bg-[#050508] px-6 py-8">
                      <dt className="text-[12px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                        {item.k}
                      </dt>
                      <dd className="mt-3 text-lg font-semibold text-white" style={display}>
                        {item.v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </MarketingReveal>
            </div>
          </section>

          {/* ─── FAQ ─── */}
          <section id="faq" className={cn(sectionY, sectionRule, 'bg-[#08080c]')}>
            <div className={shell}>
              <MarketingReveal>
                <MarketingSectionHeading
                  index="06 — FAQ"
                  title="Straight answers for buyers"
                  description="Still evaluating? Start here—then talk to us about branches, SKUs, and integrations."
                  align="center"
                  className="mx-auto"
                />
              </MarketingReveal>
              <div className="mt-14 md:mt-16">
                <LandingFaq />
              </div>
            </div>
          </section>

          {/* ─── CLOSE + SIGN IN ─── */}
          <section
            id="signin"
            className={cn(sectionY, 'relative overflow-hidden border-t border-white/[0.06]')}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(14,165,233,0.14),transparent_60%)]"
              aria-hidden
            />
            <div className={cn(shell, 'relative')}>
              <MarketingReveal>
                <div className="grid items-start gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
                  <div>
                    <p className="text-[12px] font-semibold tracking-[0.22em] text-sky-400/90 uppercase">
                      Next step
                    </p>
                    <h2
                      className="mt-4 max-w-[14ch] text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] font-semibold tracking-tight text-white"
                      style={display}
                    >
                      Give your team one place to run the day
                    </h2>
                    <p className="mt-5 max-w-md text-base leading-relaxed text-zinc-400">
                      Sign in to your workspace, or walk stakeholders through quotes, inventory, and
                      fulfilment without drowning in jargon.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link
                        href="/login"
                        className="inline-flex h-12 items-center justify-center bg-sky-500 px-7 text-[15px] font-semibold text-zinc-950 transition hover:bg-sky-400"
                      >
                        Sign in
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                      <Link
                        href="/pricing"
                        className="inline-flex h-12 items-center justify-center border border-white/20 px-7 text-[15px] font-semibold text-white transition hover:bg-white/[0.06]"
                      >
                        View pricing
                      </Link>
                    </div>
                  </div>

                  <div className="border border-white/[0.08] bg-[#0a0a0e] p-6 sm:p-8">
                    <h3 className="text-lg font-semibold text-white" style={display}>
                      Sign in
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      Use your company email for your organisation workspace.
                    </p>
                    <div className="mt-6">
                      <MarketingLoginPanel />
                    </div>
                  </div>
                </div>
              </MarketingReveal>
            </div>
          </section>
        </main>
        <MarketingFooter />
      </div>
    </div>
  );
}
