import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Layers3,
  Link2,
  LogIn,
  MapPin,
  Package,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';
import { LiveStatsBar, type PublicStats } from '@/components/landing/LiveStatsBar';
import { LandingFaq } from '@/components/landing/landing-faq';
import { HeroPremiumShowcase } from '@/components/landing/hero-premium-showcase';
import {
  BentoCard,
  BentoCardDescription,
  BentoCardHeader,
  BentoCardTitle,
  BentoGrid,
} from '@/components/ui/bento-grid';
import { cn } from '@/lib/utils';

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
});

/** ~94vw cap for immersive, investor-grade width */
const shell = 'w-[min(94vw,1728px)] mx-auto px-[clamp(1rem,3.5vw,2.75rem)]';
const sectionY = 'py-24 md:py-32';
const sectionRule = 'border-t border-white/[0.07]';

const TRUST_PILLS = [
  'Inventory-aware operations',
  'Quote-to-cash clarity',
  'Australia-ready posture',
  'Role-based access design',
];

const PROBLEMS = [
  {
    icon: FileSpreadsheet,
    title: 'Truth lives in spreadsheets',
    body: 'Orders, stock, and customer context split across files and inboxes—slowing everyone down and inviting costly mistakes.',
  },
  {
    icon: Timer,
    title: 'Teams ramp too slowly',
    body: 'Generic tools do not match how equipment suppliers actually work: quotes, branches, receiving, and finance hand-offs.',
  },
  {
    icon: Link2,
    title: 'Integrations stay “almost” live',
    body: 'Inventory, accounting, and e-commerce drift apart when systems are not orchestrated around one operational core.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Map your workflows',
    body: 'Align quotes, fulfilment, and finance with how your branches already run—no forced rip-and-replace fantasy.',
  },
  {
    step: '02',
    title: 'Connect the stack',
    body: 'Bring inventory, accounting, and commerce signals into one place so decisions are based on current reality.',
  },
  {
    step: '03',
    title: 'Train by role',
    body: 'Equip sales, warehouse, finance, and service with paths that respect their day-one jobs—not a single generic manual.',
  },
  {
    step: '04',
    title: 'Operate with confidence',
    body: 'Dashboards, alerts, and runbooks help you catch issues early and keep leadership visibility honest.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'We stopped re-keying the same order details three times. The hand-off from quote to warehouse is finally legible to everyone on the floor.',
    name: 'Operations lead',
    detail: 'National cleaning equipment distributor (Australia)',
  },
  {
    quote:
      'Finance cares about audit trails; sales cares about speed. Having one spine for customers, orders, and stock reduced support noise dramatically.',
    name: 'Head of finance & IT',
    detail: 'Multi-branch wholesale supplier',
  },
  {
    quote:
      'The win was not “more features”—it was fewer places to look when a customer calls about a delivery date or a back-order.',
    name: 'Customer service manager',
    detail: 'Equipment import & distribution',
  },
];

function SectionHeading({
  kicker,
  title,
  description,
  className,
}: {
  kicker: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-3xl text-center', className)}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400 drop-shadow-[0_0_20px_rgba(56,189,248,0.35)] sm:text-sm">
        {kicker}
      </p>
      <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.12]">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-pretty text-base leading-relaxed text-zinc-300 sm:text-lg md:text-xl">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export interface MarketingLandingProps {
  stats: PublicStats | null;
}

export function MarketingLanding({ stats }: MarketingLandingProps) {
  return (
    <div
      className={cn(
        display.className,
        'dark bg-black text-foreground min-h-screen scroll-smooth antialiased selection:bg-primary/30 selection:text-white'
      )}
    >
      <header className="sticky top-0 z-50 border-b border-white/15 bg-zinc-950/95 backdrop-blur-xl supports-backdrop-filter:bg-zinc-950/90">
        <div
          className={cn(
            shell,
            'grid grid-cols-2 items-center gap-x-3 gap-y-4 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-8 md:py-5'
          )}
        >
          <Link href="/" className="group col-start-1 row-start-1 flex min-w-0 items-center gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30 ring-2 ring-white/25 transition-transform group-hover:scale-[1.02]">
              <Layers3 className="relative z-10 h-5 w-5" strokeWidth={2.25} aria-hidden />
            </span>
            <div className="min-w-0 leading-tight">
              <span className="block truncate text-base font-bold tracking-tight text-white sm:text-lg">
                CCW Online
              </span>
              <span className="block truncate text-[11px] font-medium text-zinc-300 sm:text-xs">
                Equipment supplier operations
              </span>
            </div>
          </Link>
          <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-2 justify-self-end md:col-start-3">
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-zinc-300 hover:bg-white/10 hover:text-white sm:inline-flex"
              asChild
            >
              <Link href="/portal/orders">Customer portal</Link>
            </Button>
            <Button
              size="sm"
              className="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-5 font-semibold text-white shadow-lg shadow-sky-500/25 hover:opacity-95"
              asChild
            >
              <Link href="#signin">
                <LogIn className="mr-1.5 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </div>
          <nav className="col-span-2 row-start-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-3 text-sm font-semibold text-zinc-200 md:col-span-1 md:col-start-2 md:row-start-1 md:border-0 md:pt-0">
            {[
              ['#solution', 'Platform'],
              ['#features', 'Capabilities'],
              ['#how', 'How it works'],
              ['#faq', 'FAQ'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="whitespace-nowrap underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pb-20 pt-16 md:pb-28 md:pt-20 lg:min-h-[min(92vh,900px)] lg:flex lg:flex-col lg:justify-center lg:pb-32 lg:pt-24">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,hsl(var(--primary)/0.22),transparent_55%),radial-gradient(ellipse_60%_50%_at_100%_20%,hsl(var(--accent)/0.14),transparent_50%),radial-gradient(ellipse_50%_40%_at_0%_80%,hsl(var(--primary)/0.08),transparent_45%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:56px_56px] opacity-40"
            aria-hidden
          />
          <div className={cn(shell, 'relative grid gap-14 lg:grid-cols-12 lg:items-center lg:gap-12')}>
            <div className="lg:col-span-5">
              <Badge
                variant="secondary"
                className="mb-6 border border-sky-400/35 bg-sky-500/15 px-4 py-1.5 text-xs font-semibold text-sky-100 shadow-sm shadow-sky-500/20"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-sky-300" />
                ERP &amp; CRM for equipment suppliers
              </Badge>
              <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-[3.5rem] xl:leading-[1.02]">
                Run quotes, stock, and fulfilment from{' '}
                <span className="bg-gradient-to-r from-sky-200 via-cyan-200 to-indigo-200 bg-clip-text text-transparent">
                  one calm spine
                </span>
                .
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-zinc-300 md:text-xl">
                Replace fragmented spreadsheets and disconnected tools with a single operations platform built
                for Australian cleaning-equipment wholesalers and distributors who move real SKUs.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="h-14 rounded-xl bg-gradient-to-r from-primary to-indigo-500 px-10 text-base font-semibold text-white shadow-xl shadow-primary/30 transition hover:brightness-110"
                  asChild
                >
                  <Link href="#signin">
                    Start with your team
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-xl border-white/15 bg-white/[0.04] px-8 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/[0.08]"
                  asChild
                >
                  <Link href="#features">Explore capabilities</Link>
                </Button>
              </div>
              <div className="mt-12 flex flex-wrap gap-2.5">
                {TRUST_PILLS.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-zinc-900/60 px-3.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-sm"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-center lg:col-span-7 lg:justify-end">
              <HeroPremiumShowcase />
            </div>
          </div>
        </section>

        {stats ? (
          <LiveStatsBar stats={stats} />
        ) : (
          <section className={cn('border-white/10 bg-zinc-900/90', sectionRule)}>
            <div className={cn(shell, 'py-16 text-center md:py-20')}>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/15 ring-2 ring-sky-400/25">
                <BarChart3 className="h-9 w-9 text-sky-200" aria-hidden strokeWidth={2} />
              </div>
              <p className="text-xl font-bold tracking-tight text-white md:text-2xl">Live KPI strip</p>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 md:text-lg">
                When your data layer is connected, public stats surface here so visitors see real platform
                pulse—products, customers, orders, and monthly revenue at a glance.
              </p>
            </div>
          </section>
        )}

        {/* Problem */}
        <section id="problems" className={cn(sectionY, sectionRule, 'bg-zinc-950/40')}>
          <div className={shell}>
            <SectionHeading
              kicker="The cost of fragmentation"
              title="Your team is not slow—your systems are noisy"
              description="Equipment suppliers win on trust, delivery dates, and margin. None of that survives when every department maintains its own shadow copy of the truth."
            />
            <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
              {PROBLEMS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/90 to-black p-8 shadow-lg transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_48px_-12px_rgba(99,102,241,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative">
                    <div className="mb-5 inline-flex rounded-xl border border-sky-400/50 bg-sky-500/20 p-3.5 shadow-[0_0_28px_-6px_rgba(56,189,248,0.45)] ring-2 ring-white/15 transition-transform duration-300 group-hover:scale-105">
                      <Icon className="h-6 w-6 text-sky-100" strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-300 md:text-[15px]">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solution */}
        <section id="solution" className={cn(sectionY, sectionRule, 'bg-gradient-to-b from-black via-zinc-950/80 to-black')}>
          <div className={cn(shell, 'grid gap-16 lg:grid-cols-2 lg:items-center lg:gap-20')}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400 drop-shadow-[0_0_16px_rgba(56,189,248,0.3)]">
                Platform story
              </p>
              <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-[2.65rem] md:leading-tight">
                One operations hub—not another silo
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-zinc-300 md:text-xl">
                CCW Online ERP is designed to unify catalog, customers, quotes, orders, and warehouse-heavy
                workflows while leaving room for the integrations you already depend on—inventory bridges,
                accounting, and commerce—so leadership sees one coherent picture.
              </p>
              <ul className="mt-10 space-y-5">
                {[
                  'Dashboards, reporting, and alerts tuned for operational clarity—not vanity charts.',
                  'Deep integration roadmap: inventory systems, Xero-style accounting, Shopify-style commerce.',
                  'AI-assisted workflows where they earn trust: embedded assists, not gimmick chat-only UX.',
                  'Governance primitives: RBAC, audit-minded patterns, and production runbooks as first-class docs.',
                ].map((line) => (
                  <li key={line} className="flex gap-4 text-sm leading-relaxed text-zinc-300 md:text-[15px]">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-br from-zinc-900/95 to-black p-8 shadow-2xl ring-1 ring-white/[0.06] md:p-10">
              <div className="from-primary/20 to-accent/5 pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br blur-3xl" />
              <div className="relative space-y-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl border border-sky-400/45 bg-sky-500/20 p-3 shadow-[0_0_20px_-6px_rgba(56,189,248,0.35)] ring-1 ring-white/10">
                    <ShieldCheck className="h-8 w-8 text-sky-100" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">Built for serious operations</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      Security audits, disaster recovery, and deployment runbooks in the documentation set.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Warehouse, label: 'Warehouse', sub: 'Receiving & stock health', accent: 'text-teal-400' },
                    { icon: Truck, label: 'Fulfilment', sub: 'Branches & transfers', accent: 'text-violet-400' },
                    { icon: Users, label: 'Customers', sub: 'Contacts & history', accent: 'text-sky-400' },
                    { icon: Zap, label: 'AI roadmap', sub: 'Surface wins in-product', accent: 'text-amber-400' },
                  ].map(({ icon: Icon, label, sub, accent }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-colors hover:border-white/[0.12]"
                    >
                      <Icon className={cn('mb-2 h-5 w-5', accent)} />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-100">{sub}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-5 text-xs leading-relaxed text-zinc-400">
                  <MapPin className="h-4 w-4 shrink-0 text-sky-400" />
                  <span>
                    Designed with Australian wholesale operations in mind—validate hosting &amp; compliance with
                    your rollout team.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className={cn(sectionY, sectionRule)}>
          <div className={shell}>
            <SectionHeading
              kicker="Capabilities"
              title="Everything your floor and front office argue about—addressed in one place"
              description="Feature depth grows with your business. Start where the pain is loudest; expand when your team is ready—not when a vendor forces a big-bang cutover."
            />
            <BentoGrid columns={3} gap="lg" className="mt-16">
              <BentoCard
                span={2}
                variant="elevated"
                className="relative overflow-hidden border-white/10 bg-zinc-900/55 p-8 shadow-xl ring-1 ring-white/[0.04] md:p-10"
              >
                <div className="pointer-events-none absolute -right-24 top-0 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />
                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
                  <div className="flex shrink-0 gap-2 sm:gap-3">
                    {[
                      { Icon: FileText, label: 'Quote' },
                      { Icon: Package, label: 'Order' },
                      { Icon: TrendingUp, label: 'Cash' },
                    ].map(({ Icon, label }, idx) => (
                      <div key={label} className="flex items-center gap-2 sm:gap-3">
                        {idx > 0 ? (
                          <ArrowRight className="hidden h-4 w-4 text-zinc-600 sm:block" aria-hidden />
                        ) : null}
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/15 shadow-[0_0_24px_-8px_rgba(56,189,248,0.4)] ring-1 ring-white/10 sm:h-16 sm:w-16">
                            <Icon className="h-7 w-7 text-sky-100 sm:h-8 sm:w-8" strokeWidth={2} aria-hidden />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <BentoCardHeader className="min-w-0 flex-1 space-y-3 text-left">
                    <BentoCardTitle className="text-xl text-white sm:text-2xl">
                      Quote-to-cash you can defend
                    </BentoCardTitle>
                    <BentoCardDescription className="text-base leading-relaxed text-zinc-300">
                      Quotes, orders, line items, and fulfilment status linked so sales, warehouse, and finance stop
                      debating which spreadsheet is the real one.
                    </BentoCardDescription>
                  </BentoCardHeader>
                </div>
                <div className="relative mt-10 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Guided quoting', sub: 'Templates & guardrails' },
                    { label: 'Order conversion', sub: 'One source of truth' },
                    { label: 'Revenue visibility', sub: 'Margin you can explain' },
                  ].map(({ label, sub }) => (
                    <div
                      key={label}
                      className="group/pill rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/45 hover:bg-sky-500/12 hover:shadow-[0_12px_40px_-16px_rgba(56,189,248,0.25)]"
                    >
                      <span className="block text-sm font-bold text-white">{label}</span>
                      <span className="mt-1.5 block text-[11px] font-medium leading-tight text-zinc-500 transition-colors group-hover/pill:text-zinc-400">
                        {sub}
                      </span>
                    </div>
                  ))}
                </div>
              </BentoCard>

              <BentoCard
                variant="elevated"
                className="relative overflow-hidden border-white/10 bg-zinc-950/85 p-8 shadow-lg ring-1 ring-white/[0.04] md:p-10"
              >
                <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-teal-500/10 blur-2xl" />
                <div className="relative mb-6 inline-flex rounded-2xl border border-teal-400/35 bg-teal-500/15 p-4 shadow-[0_0_28px_-10px_rgba(45,212,191,0.35)] ring-1 ring-white/10">
                  <Warehouse className="h-8 w-8 text-teal-100" strokeWidth={2} aria-hidden />
                </div>
                <BentoCardHeader className="space-y-3 text-left">
                  <BentoCardTitle className="text-white">Inventory &amp; procurement</BentoCardTitle>
                  <BentoCardDescription className="text-[15px] leading-relaxed text-zinc-300">
                    Stock, transfers, purchase orders, and receiving workflows aligned to how distributors actually
                    move goods.
                  </BentoCardDescription>
                </BentoCardHeader>
              </BentoCard>

              <BentoCard
                variant="elevated"
                className="relative overflow-hidden border-white/10 bg-zinc-950/85 p-8 shadow-lg ring-1 ring-white/[0.04] md:p-10"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl" />
                <div className="relative mb-6 inline-flex rounded-2xl border border-violet-400/35 bg-violet-500/15 p-4 shadow-[0_0_28px_-10px_rgba(167,139,250,0.35)] ring-1 ring-white/10">
                  <Landmark className="h-8 w-8 text-violet-100" strokeWidth={2} aria-hidden />
                </div>
                <BentoCardHeader className="space-y-3 text-left">
                  <BentoCardTitle className="text-white">Finance hand-offs</BentoCardTitle>
                  <BentoCardDescription className="text-[15px] leading-relaxed text-zinc-300">
                    Invoices, reconciliation themes, and accounting connectors—documented as a roadmap, not a
                    footnote.
                  </BentoCardDescription>
                </BentoCardHeader>
              </BentoCard>

              <BentoCard
                span={2}
                variant="elevated"
                glowOnHover
                className="relative col-span-1 overflow-hidden border border-violet-500/20 bg-zinc-950/90 p-8 shadow-xl ring-1 ring-violet-500/15 md:col-span-2 md:p-10"
              >
                <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-gradient-to-br from-sky-500/25 via-indigo-600/20 to-violet-600/15 blur-3xl" />
                <div className="pointer-events-none absolute bottom-0 left-1/4 h-40 w-40 rounded-full bg-violet-600/10 blur-3xl" />
                <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
                  <div className="shrink-0">
                    <div className="inline-flex rounded-2xl border border-sky-400/45 bg-gradient-to-br from-sky-500/25 to-indigo-600/25 p-4 shadow-[0_0_32px_-8px_rgba(56,189,248,0.45)] ring-2 ring-white/15">
                      <Sparkles className="h-9 w-9 text-white" strokeWidth={2} aria-hidden />
                    </div>
                  </div>
                  <BentoCardHeader className="min-w-0 flex-1 space-y-3 text-left">
                    <BentoCardTitle className="text-xl text-white sm:text-2xl">AI where it earns trust</BentoCardTitle>
                    <BentoCardDescription className="text-base leading-relaxed text-zinc-300">
                      Agents and copilots are designed to assist inside real tasks—quotes, inventory, service—not as
                      a disconnected novelty. Training strategy focuses on discoverability and adoption, not checkbox
                      demos.
                    </BentoCardDescription>
                  </BentoCardHeader>
                </div>
                <div className="relative mt-8 flex flex-wrap gap-2 border-t border-white/[0.08] pt-6">
                  {['In-context assists', 'Inventory-aware prompts', 'Governance-first rollout'].map((chip) => (
                    <Badge
                      key={chip}
                      variant="outline"
                      className="border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur-sm"
                    >
                      {chip}
                    </Badge>
                  ))}
                </div>
              </BentoCard>
            </BentoGrid>
          </div>
        </section>

        {/* How */}
        <section id="how" className={cn(sectionY, sectionRule, 'bg-zinc-950/50')}>
          <div className={shell}>
            <SectionHeading
              kicker="How it works"
              title="A disciplined rollout—not a miracle weekend migration"
            />
            <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {STEPS.map((s) => (
                <div
                  key={s.step}
                  className="relative rounded-2xl border border-white/[0.08] bg-black/50 p-7 shadow-md transition-all hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5"
                >
                  <span className="font-black tabular-nums text-5xl leading-none text-sky-500/50">{s.step}</span>
                  <h3 className="mt-4 text-lg font-bold text-white">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className={cn(sectionY, sectionRule)}>
          <div className={shell}>
            <SectionHeading
              kicker="Proof tone"
              title="Written for operators—not slide decks"
              description="Illustrative quotes based on common wholesale pain patterns; not attributed to specific named customers."
            />
            <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
              {TESTIMONIALS.map((t) => (
                <blockquote
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/80 to-black p-8 shadow-lg"
                >
                  <p className="grow text-sm leading-relaxed text-zinc-200 md:text-[15px]">&ldquo;{t.quote}&rdquo;</p>
                  <footer className="mt-8 border-t border-white/[0.08] pt-5">
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="mt-1 text-xs text-zinc-400">{t.detail}</p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className={cn(sectionY, sectionRule, 'bg-zinc-950/60')}>
          <div className={shell}>
            <SectionHeading
              kicker="FAQ"
              title="Straight answers for buyers"
              description="Still evaluating? Start here—then talk to us about your branches, SKUs, and integrations."
            />
            <div className="mt-16 md:mt-20">
              <LandingFaq />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={cn(sectionY, 'relative overflow-hidden border-t border-white/[0.08]')}>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary via-indigo-600 to-accent opacity-95"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,rgba(0,0,0,0.35),transparent)]"
            aria-hidden
          />
          <div className={cn(shell, 'relative text-center')}>
            <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-[2.5rem]">
              Ready to give your team one spine for operations?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl">
              Sign in to your workspace, or bring stakeholders to walk the modules that matter most—quotes,
              inventory, fulfilment, and finance—without drowning in jargon.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                variant="secondary"
                className="h-14 rounded-xl px-10 text-base font-semibold shadow-xl"
                asChild
              >
                <Link href="#signin">
                  Sign in to CCW Online
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 rounded-xl border-white/40 bg-white/10 px-10 text-base font-semibold text-white backdrop-blur-md hover:bg-white/20"
                asChild
              >
                <Link href="/portal/orders">Open customer portal</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Sign in */}
        <section id="signin" className={cn(sectionRule, 'relative bg-black pb-24 pt-16 md:pb-28 md:pt-20')}>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-xl bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"
            aria-hidden
          />
          <div className={cn(shell, 'max-w-lg')}>
            <Card className="relative overflow-hidden border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50 ring-1 ring-white/10">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500/80 via-indigo-500 to-violet-500 opacity-90"
                aria-hidden
              />
              <CardHeader className="space-y-1 border-b border-white/[0.07] bg-gradient-to-b from-zinc-900/80 to-zinc-950/40 px-8 pb-8 pt-10 text-center">
                <div className="mx-auto mb-3 w-fit rounded-2xl border border-sky-400/45 bg-sky-500/15 p-3 shadow-[0_0_28px_-8px_rgba(56,189,248,0.45)] ring-1 ring-white/15">
                  <LogIn className="h-6 w-6 text-sky-100" strokeWidth={2} />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-white">Sign in</CardTitle>
                <CardDescription className="text-base leading-relaxed text-zinc-300">
                  Access your organisation workspace with your company email.
                </CardDescription>
              </CardHeader>
              <CardContent className="bg-zinc-950/60 px-6 pb-10 pt-8 md:px-8">
                <LoginForm variant="marketing" />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className={cn(sectionRule, 'border-white/[0.08] bg-zinc-950/80')}>
        <div
          className={cn(
            shell,
            'flex flex-col items-center justify-between gap-4 py-12 text-sm text-zinc-500 sm:flex-row'
          )}
        >
          <div className="flex items-center gap-2.5">
            <Layers3 className="h-5 w-5 text-sky-400" />
            <span className="font-semibold text-zinc-200">CCW Online ERP</span>
          </div>
          <p className="text-center sm:text-right">
            &copy; {new Date().getFullYear()} CCW Equipment Suppliers. Brisbane · Sydney · Melbourne
          </p>
        </div>
      </footer>
    </div>
  );
}
