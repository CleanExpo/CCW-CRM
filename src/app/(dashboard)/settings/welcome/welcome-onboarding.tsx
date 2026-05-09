'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, type Variants } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  LayoutDashboard,
  Link2,
  Package,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
};

const CAPABILITIES = [
  {
    title: 'Operations',
    description:
      'Orders, quotes, purchase orders, fulfilment, POS, and warehouse workflows in one place.',
    href: '/dashboard/operations/orders',
    icon: ShoppingCart,
    accent: 'from-sky-500/25 via-sky-500/5 to-transparent',
    ring: 'ring-sky-500/25',
  },
  {
    title: 'CRM & customers',
    description:
      'Track accounts, contacts, service requests, and client health so nothing falls through.',
    href: '/dashboard/crm/customers',
    icon: Users,
    accent: 'from-violet-500/25 via-violet-500/5 to-transparent',
    ring: 'ring-violet-500/25',
  },
  {
    title: 'Inventory',
    description:
      'Products, stock levels, transfers, BOM, forecasts — stay ahead of backorders.',
    href: '/dashboard/inventory/products',
    icon: Package,
    accent: 'from-emerald-500/25 via-emerald-500/5 to-transparent',
    ring: 'ring-emerald-500/25',
  },
  {
    title: 'Finance',
    description: 'Invoices, BAS, bank feeds, and email — aligned with how your team works.',
    href: '/dashboard/finance/invoices',
    icon: Wallet,
    accent: 'from-amber-500/25 via-amber-500/5 to-transparent',
    ring: 'ring-amber-500/25',
  },
  {
    title: 'Integrations',
    description:
      'Connect Xero, Shopify, Cin7, email, and more so data flows without double entry.',
    href: '/dashboard/settings/integrations',
    icon: Link2,
    accent: 'from-cyan-500/25 via-cyan-500/5 to-transparent',
    ring: 'ring-cyan-500/25',
  },
  {
    title: 'AI & reports',
    description: 'Assistant, insights, and reporting to spot trends and answer questions faster.',
    href: '/dashboard/ai-reports/ai-assistant',
    icon: Bot,
    accent: 'from-fuchsia-500/25 via-fuchsia-500/5 to-transparent',
    ring: 'ring-fuchsia-500/25',
  },
] as const;

export function WelcomeOnboarding() {
  const searchParams = useSearchParams();
  const fromRegister = searchParams.get('from') === 'register';

  return (
    <div className="relative mx-auto max-w-5xl pb-10">
      <div
        className="pointer-events-none absolute -top-6 left-1/2 h-64 w-[min(100%,42rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.22),transparent_65%)] blur-2xl"
        aria-hidden
      />

      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative mb-10 text-center md:mb-12"
      >
        {fromRegister && (
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 bg-primary/10 text-primary-foreground"
          >
            Account created
          </Badge>
        )}
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-white/12 to-white/[0.04] shadow-lg shadow-black/40">
            <Sparkles className="h-7 w-7 text-primary" aria-hidden />
          </div>
        </div>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-white md:text-4xl">
          Welcome to your workspace
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed md:text-lg">
          CCW brings operations, inventory, CRM, and finance together. Use this hub to see what you
          can do next — connect your tools, invite your team, or jump straight into the dashboard.
        </p>
      </motion.header>

      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-labelledby="capabilities-heading"
      >
        <h2 id="capabilities-heading" className="sr-only">
          What you can do
        </h2>
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          return (
            <motion.div key={cap.title} variants={item}>
              <Link
                href={cap.href}
                className={cn(
                  'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/40 p-5 shadow-xl shadow-black/20 transition-all duration-300',
                  'hover:border-white/20 hover:bg-zinc-900/50 hover:shadow-primary/5'
                )}
              >
                <div
                  className={cn(
                    'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90',
                    cap.accent
                  )}
                  aria-hidden
                />
                <div
                  className={cn(
                    'relative mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-black/30 ring-1 backdrop-blur-sm',
                    cap.ring
                  )}
                >
                  <Icon className="h-5 w-5 text-white" aria-hidden />
                </div>
                <h3 className="relative text-lg font-semibold text-white">{cap.title}</h3>
                <p className="relative mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                  {cap.description}
                </p>
                <span className="relative mt-4 inline-flex items-center text-sm font-medium text-primary group-hover:gap-2">
                  Open
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          );
        })}
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="relative mt-10 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black p-6 md:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-2">
            <div className="flex items-center gap-2 text-white">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Recommended next steps</span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-400">
              Connect systems under Integrations, use the Setup guide checklist for go-live, invite
              teammates from Team settings, and open the dashboard when you are ready.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="rounded-xl shadow-lg shadow-primary/20">
              <Link href="/dashboard/settings/integrations">Connect integrations</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="rounded-xl bg-white/10 text-white hover:bg-white/15">
              <Link href="/dashboard/settings/integrations?tab=setup">Setup guide</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl border-white/20 bg-transparent">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-sm">
          <Link
            href="/dashboard/settings/team"
            className="text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            Team & invites
          </Link>
          <Link
            href="/dashboard/settings/company"
            className="text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            Company profile
          </Link>
          <Link
            href="/dashboard/settings/account"
            className="text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            Your account
          </Link>
          <Link
            href="/dashboard/settings/setup"
            className="text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            Connection checklist
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
