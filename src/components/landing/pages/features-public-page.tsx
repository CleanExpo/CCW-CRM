import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bot,
  ClipboardList,
  FileText,
  LineChart,
  Package,
  ShieldCheck,
  Truck,
  Warehouse,
} from 'lucide-react';
import { MarketingSectionHeading } from '@/components/landing/marketing-section-heading';
import { MarketingHeroBackdrop } from '@/components/landing/marketing-page-visuals';
import { marketingSectionRule, marketingSectionY, marketingShell } from '@/components/landing/marketing-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CAPABILITY_GROUPS = [
  {
    title: 'Sales & quote-to-cash',
    blurb: 'Guided quoting through order conversion with revenue visibility sales and finance can agree on.',
    items: [
      { icon: FileText, label: 'Quotes & proposals' },
      { icon: ClipboardList, label: 'Orders & lines' },
      { icon: LineChart, label: 'Pipeline & margin' },
    ],
    gradient: 'from-sky-500/20 via-zinc-900/40 to-indigo-600/15',
  },
  {
    title: 'Inventory & fulfilment',
    blurb: 'Stock health, transfers, and receiving tuned to multi-branch distributors.',
    items: [
      { icon: Warehouse, label: 'Warehouses & bins' },
      { icon: Package, label: 'Transfers & POs' },
      { icon: Truck, label: 'Fulfilment status' },
    ],
    gradient: 'from-teal-500/15 via-zinc-900/40 to-cyan-600/10',
  },
  {
    title: 'Governance & insight',
    blurb: 'Controls, reporting, and AI assists that respect operational trust.',
    items: [
      { icon: ShieldCheck, label: 'RBAC & audit patterns' },
      { icon: BarChart3, label: 'Dashboards & reports' },
      { icon: Bot, label: 'In-context AI assists' },
    ],
    gradient: 'from-violet-500/20 via-zinc-900/40 to-fuchsia-600/10',
  },
];

export function FeaturesPublicPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-16 pb-12 md:pt-24 md:pb-16">
        <MarketingHeroBackdrop />
        <div className={cn(marketingShell, 'relative z-10 text-center')}>
          <p className="text-xs font-bold tracking-[0.22em] text-sky-400 uppercase drop-shadow-[0_0_20px_rgba(56,189,248,0.35)] sm:text-sm">
            Features
          </p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-extrabold tracking-tight text-balance text-white sm:text-5xl md:text-[3.15rem] md:leading-[1.08]">
            Depth where wholesale operations hurt most
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-xl">
            Modular capability across quotes, inventory, finance hand-offs, and insights—expand when your team is ready,
            not when a vendor forces a big-bang cutover.
          </p>
          <Button
            size="lg"
            className="mt-10 h-14 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-10 text-base font-semibold text-white shadow-xl shadow-sky-500/25 hover:brightness-110"
            asChild
          >
            <Link href="/login">
              Log in to explore
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule, 'relative bg-zinc-950/50')}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />
        <div className={cn(marketingShell, 'relative')}>
          <MarketingSectionHeading
            kicker="Capability map"
            title="Three pillars that mirror your floor and front office"
            description="Each area is designed to connect—not as isolated modules bolted together after the fact."
          />
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {CAPABILITY_GROUPS.map((g) => (
              <div
                key={g.title}
                className={cn(
                  'relative overflow-hidden rounded-3xl border border-white/10 p-8 shadow-xl ring-1 ring-white/5',
                  'bg-gradient-to-br',
                  g.gradient
                )}
              >
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
                <div className="relative">
                  <h2 className="text-xl font-bold text-white">{g.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">{g.blurb}</p>
                  <ul className="mt-8 space-y-4">
                    {g.items.map(({ icon: Icon, label }) => (
                      <li
                        key={label}
                        className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-sm"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-200">
                          <Icon className="h-5 w-5" strokeWidth={2} />
                        </span>
                        <span className="font-semibold text-zinc-100">{label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(marketingSectionY, marketingSectionRule)}>
        <div className={cn(marketingShell, 'text-center')}>
          <MarketingSectionHeading
            kicker="How modules fit"
            title="Start where the pain is loudest"
            description="Roll out quote-to-order first, then deepen inventory and finance as your team earns confidence."
          />
          <div className="mx-auto mt-14 max-w-4xl rounded-[2rem] border border-white/10 bg-gradient-to-b from-zinc-900/90 to-black p-10 shadow-2xl ring-1 ring-white/10">
            <div className="grid gap-6 sm:grid-cols-3">
              {['Quotes & orders', 'Inventory & warehouse', 'Finance & insight'].map((step, i) => (
                <div key={step} className="relative">
                  {i > 0 ? (
                    <div className="absolute -left-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-gradient-to-r from-sky-500/50 to-transparent sm:block" />
                  ) : null}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center">
                    <span className="text-xs font-bold text-sky-400">Phase {i + 1}</span>
                    <p className="mt-2 font-bold text-white">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Button variant="outline" className="mt-12 border-white/15 bg-white/[0.04] text-white hover:bg-white/10" asChild>
            <Link href="/how-it-works">See how rollout works</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
