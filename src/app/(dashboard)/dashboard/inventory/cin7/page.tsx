'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cin7MasterDataNav } from '@/components/integrations/Cin7MasterDataNav';
import { Cin7SyncButton } from '@/components/integrations/Cin7SyncButton';
import {
  CIN7_FLOW_STEPS,
  CIN7_INTEGRATIONS_ANCHOR,
  CIN7_VERIFY_PAGES,
} from '@/lib/integrations/cin7-master-data-routes';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
};

export default function Cin7MasterDataHubPage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 via-transparent to-teal-500/5 p-6 md:p-8"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_100%_0%,hsl(var(--primary)/0.15),transparent_60%)]"
          aria-hidden
        />
        <div className="relative max-w-2xl space-y-3">
          <Badge variant="outline" className="border-primary/30 bg-primary/5">
            Cin7 master data
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Verify synced data</h1>
          <p className="text-muted-foreground leading-relaxed">
            After connecting Cin7 under Integrations, open each module below to confirm products,
            customers, suppliers, branches, categories, brands, price lists, tax codes, stock, and
            orders landed correctly. Manual sync is available on every page.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link href={CIN7_INTEGRATIONS_ANCHOR}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync & reconcile
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/integrations?tab=setup">Setup guide</Link>
            </Button>
          </div>
        </div>
      </motion.header>

      <Cin7MasterDataNav active="hub" />

      <motion.ol
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-3 md:grid-cols-3"
      >
        {CIN7_FLOW_STEPS.map((step) => (
          <motion.li
            key={step.step}
            variants={item}
            className="rounded-xl border border-white/10 bg-black/20 p-4"
          >
            <span className="text-primary text-xs font-semibold tracking-wide uppercase">
              Step {step.step}
            </span>
            <h2 className="mt-1 font-semibold">{step.title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{step.description}</p>
            <Button variant="link" size="sm" className="mt-2 h-auto px-0" asChild>
              <Link href={step.href}>
                {step.cta}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </motion.li>
        ))}
      </motion.ol>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {CIN7_VERIFY_PAGES.map((page) => {
          const Icon = page.icon;
          return (
            <motion.article
              key={page.key}
              variants={item}
              className="group flex flex-col rounded-xl border border-white/10 bg-card/40 p-5 transition-shadow hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-primary/10">
                  <Icon className="text-primary h-5 w-5" />
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {page.module}
                </Badge>
              </div>
              <h3 className="font-semibold tracking-tight">{page.label}</h3>
              <p className="text-muted-foreground mt-1 flex-1 text-sm">{page.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={page.href}>
                    Open
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Cin7SyncButton entity={page.key} size="sm" variant="ghost" />
              </div>
            </motion.article>
          );
        })}
      </motion.div>
    </div>
  );
}
