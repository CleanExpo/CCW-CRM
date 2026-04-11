import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  Layers3,
  Link2,
  LogIn,
  MapPin,
  ShieldCheck,
  Sparkles,
  Timer,
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
import { ErpDashboardMockup } from '@/components/landing/erp-dashboard-mockup';
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

const TRUST_PILLS = [
  'Inventory-aware operations',
  'Quote-to-cash clarity',
  'Australia-focused hosting story',
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

export interface MarketingLandingProps {
  stats: PublicStats | null;
}

export function MarketingLanding({ stats }: MarketingLandingProps) {
  return (
    <div className={cn(display.className, 'bg-background text-foreground min-h-screen scroll-smooth')}>
      {/* Top bar */}
      <header className="border-border/60 bg-background/75 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="bg-primary flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md shadow-primary/25">
              <Layers3 className="h-5 w-5" aria-hidden />
            </span>
            <div className="leading-tight">
              <span className="text-base font-bold tracking-tight sm:text-lg">CCW Online</span>
              <span className="text-muted-foreground block text-[11px] font-medium sm:text-xs">
                Equipment supplier operations
              </span>
            </div>
          </Link>
          <nav className="text-muted-foreground hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#solution" className="hover:text-foreground transition-colors">
              Platform
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Capabilities
            </a>
            <a href="#how" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="/portal/orders">Customer portal</Link>
            </Button>
            <Button size="sm" className="shadow-sm" asChild>
              <Link href="#signin">
                <LogIn className="mr-1.5 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(var(--primary)/0.18),transparent_50%),radial-gradient(ellipse_80%_50%_at_100%_0%,hsl(var(--accent)/0.12),transparent_45%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 md:grid-cols-2 md:items-center md:gap-10 md:pb-24 md:pt-16 lg:pt-20">
            <div>
              <Badge
                variant="secondary"
                className="border-primary/20 bg-primary/5 text-primary mb-5 gap-1.5 px-3 py-1 font-medium"
              >
                <Sparkles className="h-3.5 w-3.5" />
                ERP &amp; CRM for equipment suppliers
              </Badge>
              <h1 className="text-foreground text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
                Run quotes, stock, and fulfilment{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  from one calm spine
                </span>
                .
              </h1>
              <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-relaxed">
                Replace fragmented spreadsheets and disconnected tools with a single operations platform
                built for Australian cleaning-equipment wholesalers and distributors who move real SKUs.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="h-12 rounded-xl px-8 text-base shadow-lg shadow-primary/20" asChild>
                  <Link href="#signin">
                    Start with your team
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 rounded-xl border-border/80 px-6" asChild>
                  <Link href="#features">Explore capabilities</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-2">
                {TRUST_PILLS.map((t) => (
                  <span
                    key={t}
                    className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-xs font-medium backdrop-blur-sm"
                  >
                    <CheckCircle2 className="text-primary h-3.5 w-3.5 shrink-0" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-center md:justify-end">
              <ErpDashboardMockup />
            </div>
          </div>
        </section>

        {/* Live stats */}
        {stats ? (
          <LiveStatsBar stats={stats} />
        ) : (
          <section className="border-border/60 bg-muted/20 border-y">
            <div className="text-muted-foreground mx-auto max-w-3xl px-4 py-8 text-center text-sm leading-relaxed sm:px-6">
              <BarChart3 className="text-primary mx-auto mb-3 h-8 w-8 opacity-80" />
              <p className="font-medium text-foreground">Live KPI strip</p>
              <p className="mt-1">
                When your data layer is connected, public stats surface here so visitors see real platform
                pulse—products, customers, orders, and monthly revenue at a glance.
              </p>
            </div>
          </section>
        )}

        {/* Problem */}
        <section id="problems" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest">The cost of fragmentation</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Your team is not slow—your systems are noisy
            </h2>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              Equipment suppliers win on trust, delivery dates, and margin. None of that survives when every
              department maintains its own shadow copy of the truth.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PROBLEMS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group border-border/80 from-card to-muted/20 hover:border-primary/25 relative overflow-hidden rounded-2xl border bg-gradient-to-b p-6 shadow-sm transition-all hover:shadow-md md:p-8"
              >
                <div className="bg-primary/10 text-primary mb-4 inline-flex rounded-xl p-3 ring-1 ring-primary/10 transition-transform group-hover:scale-105">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed md:text-[15px]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Solution */}
        <section
          id="solution"
          className="border-border/60 from-muted/40 via-background to-background border-y bg-gradient-to-b py-20 md:py-24"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-primary text-sm font-semibold uppercase tracking-widest">Platform story</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                One operations hub—not another silo
              </h2>
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                CCW Online ERP is designed to unify catalog, customers, quotes, orders, and warehouse-heavy
                workflows while leaving room for the integrations you already depend on—inventory bridges,
                accounting, and commerce—so leadership sees one coherent picture.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'Dashboards, reporting, and alerts tuned for operational clarity—not vanity charts.',
                  'Deep integration roadmap: inventory systems, Xero-style accounting, Shopify-style commerce.',
                  'AI-assisted workflows where they earn trust: embedded assists, not gimmick chat-only UX.',
                  'Governance primitives: RBAC, audit-minded patterns, and production runbooks as first-class docs.',
                ].map((line) => (
                  <li key={line} className="flex gap-3 text-sm leading-relaxed md:text-[15px]">
                    <CheckCircle2 className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-border/80 relative overflow-hidden rounded-3xl border bg-card p-6 shadow-xl md:p-8">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" aria-hidden />
              <div className="relative space-y-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-primary h-10 w-10" />
                  <div>
                    <p className="text-sm font-semibold">Built for serious operations</p>
                    <p className="text-muted-foreground text-xs">
                      Security audits, disaster recovery, and deployment runbooks in the documentation set.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/80 bg-muted/30 p-4">
                    <Warehouse className="text-accent mb-2 h-5 w-5" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Warehouse
                    </p>
                    <p className="mt-1 text-sm font-bold">Receiving &amp; stock health</p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-muted/30 p-4">
                    <Truck className="text-primary mb-2 h-5 w-5" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Fulfilment
                    </p>
                    <p className="mt-1 text-sm font-bold">Branches &amp; transfers</p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-muted/30 p-4">
                    <Users className="text-primary mb-2 h-5 w-5" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Customers
                    </p>
                    <p className="mt-1 text-sm font-bold">Contacts &amp; history</p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-muted/30 p-4">
                    <Zap className="text-amber-500 mb-2 h-5 w-5" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      AI roadmap
                    </p>
                    <p className="mt-1 text-sm font-bold">Surface wins in-product</p>
                  </div>
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 border-t pt-4 text-xs">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>Designed with Australian wholesale operations in mind—validate hosting &amp; compliance with your rollout team.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features bento */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest">Capabilities</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything your floor and front office argue about—addressed in one place
            </h2>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              Feature depth grows with your business. Start where the pain is loudest; expand when your team
              is ready—not when a vendor forces a big-bang cutover.
            </p>
          </div>

          <BentoGrid columns={3} gap="lg" className="mt-14">
            <BentoCard span={2} variant="elevated" className="md:p-8">
              <BentoCardHeader>
                <BentoCardTitle className="text-xl sm:text-2xl">Quote-to-cash you can defend</BentoCardTitle>
                <BentoCardDescription className="text-base">
                  Quotes, orders, line items, and fulfilment status linked so sales, warehouse, and finance
                  stop debating which spreadsheet is “the real one”.
                </BentoCardDescription>
              </BentoCardHeader>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {['Guided quoting', 'Order conversion', 'Revenue visibility'].map((label) => (
                  <div key={label} className="bg-primary/5 rounded-xl border border-primary/10 px-3 py-3 text-center">
                    <span className="text-sm font-semibold">{label}</span>
                  </div>
                ))}
              </div>
            </BentoCard>

            <BentoCard variant="default" className="md:p-8">
              <BentoCardHeader>
                <BentoCardTitle>Inventory &amp; procurement</BentoCardTitle>
                <BentoCardDescription>
                  Stock, transfers, purchase orders, and receiving workflows aligned to how distributors actually move goods.
                </BentoCardDescription>
              </BentoCardHeader>
            </BentoCard>

            <BentoCard variant="default" className="md:p-8">
              <BentoCardHeader>
                <BentoCardTitle>Finance hand-offs</BentoCardTitle>
                <BentoCardDescription>
                  Invoices, reconciliation themes, and accounting connectors—documented as a roadmap, not a footnote.
                </BentoCardDescription>
              </BentoCardHeader>
            </BentoCard>

            <BentoCard span={2} variant="gradient" glowOnHover className="md:p-8">
              <BentoCardHeader>
                <BentoCardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="text-primary h-5 w-5" />
                  AI where it earns trust
                </BentoCardTitle>
                <BentoCardDescription className="text-base">
                  Agents and copilots are designed to assist inside real tasks—quotes, inventory, service—not as a
                  disconnected novelty. Training strategy focuses on discoverability and adoption, not checkbox demos.
                </BentoCardDescription>
              </BentoCardHeader>
            </BentoCard>
          </BentoGrid>
        </section>

        {/* How it works */}
        <section id="how" className="bg-muted/30 border-border/60 border-y py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-primary text-sm font-semibold uppercase tracking-widest">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                A disciplined rollout—not a miracle weekend migration
              </h2>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div
                  key={s.step}
                  className="border-border/80 relative rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="text-primary/35 font-black tabular-nums text-4xl leading-none">{s.step}</span>
                  <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest">Proof tone</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Written for operators—not slide decks
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">
              Illustrative quotes based on common wholesale pain patterns; not attributed to specific named customers.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <blockquote
                key={t.name}
                className="border-border/80 flex flex-col rounded-2xl border bg-card p-6 shadow-sm md:p-8"
              >
                <p className="text-foreground grow text-sm leading-relaxed md:text-[15px]">&ldquo;{t.quote}&rdquo;</p>
                <footer className="border-border/60 mt-6 border-t pt-4">
                  <p className="text-sm font-bold">{t.name}</p>
                  <p className="text-muted-foreground text-xs">{t.detail}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-border/60 bg-muted/20 border-t py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-primary text-sm font-semibold uppercase tracking-widest">FAQ</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Straight answers for buyers</h2>
              <p className="text-muted-foreground mt-4 text-lg">
                Still evaluating? Start here—then talk to us about your branches, SKUs, and integrations.
              </p>
            </div>
            <div className="mt-12">
              <LandingFaq />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden py-20 md:py-24">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/90 via-primary to-accent/90"
            aria-hidden
          />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ready to give your team one spine for operations?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/90">
              Sign in to your workspace, or bring stakeholders to walk the modules that matter most—quotes,
              inventory, fulfilment, and finance—without drowning in jargon.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                variant="secondary"
                className="h-12 rounded-xl px-8 text-base font-semibold shadow-lg"
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
                className="h-12 rounded-xl border-white/40 bg-white/10 px-8 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20"
                asChild
              >
                <Link href="/portal/orders">Open customer portal</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Sign in */}
        <section id="signin" className="border-border/60 border-t">
          <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-20">
            <Card className="overflow-hidden border-border/80 shadow-xl">
              <CardHeader className="bg-muted/30 text-center">
                <div className="bg-primary/10 mx-auto mb-2 w-fit rounded-xl p-2.5">
                  <LogIn className="text-primary h-5 w-5" />
                </div>
                <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                  Access your organisation workspace with your company email.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <LoginForm />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-border/60 bg-muted/20 border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Layers3 className="text-primary h-5 w-5" />
            <span className="font-semibold text-foreground">CCW Online ERP</span>
          </div>
          <p className="text-center sm:text-right">
            &copy; {new Date().getFullYear()} CCW Equipment Suppliers. Brisbane · Sydney · Melbourne
          </p>
        </div>
      </footer>
    </div>
  );
}
