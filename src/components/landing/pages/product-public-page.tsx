import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Gauge,
  Link2,
  MapPin,
  Shield,
  Target,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react';
import { MarketingSectionHeading } from '@/components/landing/marketing-section-heading';
import { MarketingHeroBackdrop, ProductSpineGraphic, UiMockupStrip } from '@/components/landing/marketing-page-visuals';
import { marketingSectionRule, marketingSectionY, marketingShell } from '@/components/landing/marketing-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ICP_ROWS = [
  {
    title: 'Australian wholesale',
    body: 'Branches, GST-aware workflows, and APAC hosting posture discussed in implementation docs.',
    icon: MapPin,
  },
  {
    title: 'Equipment & SKUs',
    body: 'Catalog, variants, and stock semantics that match distributors—not lightweight retail SKUs only.',
    icon: Target,
  },
  {
    title: 'Multi-role teams',
    body: 'Sales counter, warehouse floor, and finance office each get purpose-built paths—not one generic app.',
    icon: Users,
  },
  {
    title: 'Serious throughput',
    body: 'Designed for order volume and integration load as you connect inventory and accounting systems.',
    icon: Gauge,
  },
];

const PILLARS = [
  {
    title: 'Quote-to-cash',
    body: 'Quotes, orders, and fulfilment status in one thread—so sales, warehouse, and finance stop debating which spreadsheet is true.',
    icon: BarChart3,
    accent: 'from-sky-500/25 to-indigo-600/20',
  },
  {
    title: 'Inventory & branches',
    body: 'Stock, transfers, and receiving aligned to how distributors move goods across locations—not a generic retail POS mindset.',
    icon: Warehouse,
    accent: 'from-teal-500/20 to-emerald-600/15',
  },
  {
    title: 'Governed access',
    body: 'Role-based patterns and audit-minded workflows so scaling teams do not trade speed for control.',
    icon: Shield,
    accent: 'from-violet-500/20 to-purple-600/15',
  },
];

export function ProductPublicPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
        <MarketingHeroBackdrop />
        <div className={cn(marketingShell, 'relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16')}>
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-sky-400 uppercase drop-shadow-[0_0_20px_rgba(56,189,248,0.35)] sm:text-sm">
              Product
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-balance text-white sm:text-5xl md:text-[3rem] md:leading-[1.08]">
              One operational spine for equipment suppliers
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300 md:text-xl">
              CCW Online ERP unifies catalog, customers, quotes, orders, and warehouse-heavy workflows—so your team runs
              on a single source of truth instead of scattered files and tools.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                size="lg"
                className="h-14 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-8 text-base font-semibold text-white shadow-xl shadow-sky-500/25 hover:brightness-110"
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
                className="h-14 rounded-xl border-white/15 bg-white/[0.04] px-8 text-base font-semibold text-white hover:bg-white/[0.08]"
                asChild
              >
                <Link href="/features">Explore features</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <ProductSpineGraphic className="mx-auto max-w-lg lg:max-w-none" />
            <div className="absolute -bottom-6 -left-4 hidden w-[min(100%,340px)] md:block">
              <UiMockupStrip className="rotate-[-2deg] shadow-2xl" />
            </div>
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'bg-zinc-950/40')}>
        <div className={marketingShell}>
          <MarketingSectionHeading
            kicker="Why it exists"
            title="Built for wholesale reality—not generic SaaS"
            description="From SKU-led catalog to finance hand-offs, the product mirrors how equipment distributors actually operate."
          />
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {PILLARS.map(({ title, body, icon: Icon, accent }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black p-8 shadow-lg transition-all hover:border-sky-500/25"
              >
                <div
                  className={cn(
                    'pointer-events-none absolute inset-0 opacity-60 transition-opacity group-hover:opacity-100',
                    `bg-gradient-to-br ${accent}`
                  )}
                />
                <div className="relative">
                  <div className="mb-5 inline-flex rounded-xl border border-white/15 bg-white/5 p-3.5 ring-1 ring-white/10">
                    <Icon className="h-7 w-7 text-sky-200" strokeWidth={2} />
                  </div>
                  <h2 className="text-lg font-bold text-white">{title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300 md:text-[15px]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule)}>
        <div className={cn(marketingShell, 'grid gap-12 lg:grid-cols-2 lg:items-center')}>
          <div className="order-2 lg:order-1">
            <UiMockupStrip className="mx-auto max-w-md shadow-2xl lg:mx-0" />
          </div>
          <div className="order-1 space-y-5 lg:order-2">
            <p className="text-xs font-bold tracking-[0.22em] text-sky-400 uppercase">Connected operations</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Integrations as a hub—not another silo
            </h2>
            <p className="text-lg leading-relaxed text-zinc-300">
              Roadmap and connectors point toward inventory platforms, accounting, and commerce living alongside your core
              ERP workflows—so leadership sees one coherent picture.
            </p>
            <ul className="space-y-3 text-zinc-300">
              <li className="flex items-start gap-3">
                <Link2 className="mt-1 h-5 w-5 shrink-0 text-sky-400" />
                <span>Deep links to systems your teams already rely on—implemented in phases that match your rollout.</span>
              </li>
              <li className="flex items-start gap-3">
                <Users className="mt-1 h-5 w-5 shrink-0 text-sky-400" />
                <span>Role-aware surfaces so sales, warehouse, and finance each get clarity without noise.</span>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="mt-1 h-5 w-5 shrink-0 text-sky-400" />
                <span>AI-assisted workflows embedded where they earn trust—not a disconnected chat-only layer.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'bg-zinc-950/50')}>
        <div className={marketingShell}>
          <MarketingSectionHeading
            kicker="Who it fits"
            title="Built for distributors who move real stock"
            description="If your world is quotes, branches, receiving docks, and reconciliation—not generic CRM leads—this product language will feel familiar."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ICP_ROWS.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/70 to-black p-6 shadow-lg ring-1 ring-white/[0.04] transition-all hover:border-sky-500/20"
              >
                <div className="mb-4 inline-flex rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5">
                  <Icon className="h-5 w-5 text-sky-200" strokeWidth={2} />
                </div>
                <h3 className="font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule)}>
        <div className={cn(marketingShell, 'grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16')}>
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-sky-400 uppercase">Outcomes</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Fewer hand-offs, clearer ownership
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-300">
              When catalog, customers, and orders share one spine, leadership stops reconciling three systems for every
              escalation—and teams stop duplicating data in spreadsheets.
            </p>
            <ul className="mt-8 space-y-4 text-zinc-300">
              <li className="flex gap-3 border-l-2 border-sky-500/50 pl-4">
                <span className="font-semibold text-white">Single thread for an order</span> from quote acceptance through
                pick/pack signals your floor can trust.
              </li>
              <li className="flex gap-3 border-l-2 border-violet-500/40 pl-4">
                <span className="font-semibold text-white">Finance sees the same truth</span> sales promised—without manual
                exports every Friday.
              </li>
            </ul>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_70%_30%,rgba(56,189,248,0.12),transparent_55%)]" />
            <UiMockupStrip className="relative z-10 shadow-2xl" />
          </div>
        </div>
      </section>

      <section
        className={cn(
          marketingSectionY,
          'relative overflow-hidden border-t border-white/[0.08] bg-gradient-to-br from-zinc-950 via-black to-indigo-950/40'
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(99,102,241,0.15),transparent)]" />
        <div className={cn(marketingShell, 'relative text-center')}>
          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">See the full capability map</h2>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">
            Features, pricing, and rollout detail live on dedicated pages—same visual system, zero login required to browse.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              className="h-12 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-8 font-semibold text-white shadow-lg"
              asChild
            >
              <Link href="/features">Browse features</Link>
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-xl border-white/20 bg-white/5 px-8 font-semibold text-white hover:bg-white/10"
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
