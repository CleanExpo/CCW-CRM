'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { triggerCin7Sync } from '@/lib/api/cin7';
import {
  CIN7_INTEGRATIONS_ANCHOR,
  getCin7VerifyPage,
} from '@/lib/integrations/cin7-master-data-routes';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, RefreshCw, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export type Cin7SyncEntity =
  | 'products'
  | 'customers'
  | 'internal-customers'
  | 'suppliers'
  | 'branches'
  | 'warehouses'
  | 'product-categories'
  | 'brands'
  | 'price-lists'
  | 'tax-codes'
  | 'units-of-measure'
  | 'stock-levels'
  | 'orders'
  | 'inventory';

const ENTITY_LABELS: Record<Cin7SyncEntity, string> = {
  products: 'Products',
  customers: 'Customers',
  'internal-customers': 'Internal customers',
  suppliers: 'Suppliers',
  branches: 'Branches',
  warehouses: 'Warehouses',
  'product-categories': 'Product categories',
  brands: 'Brands',
  'price-lists': 'Price lists',
  'tax-codes': 'Tax codes',
  'units-of-measure': 'Units of measure',
  'stock-levels': 'Stock levels',
  orders: 'Orders',
  inventory: 'Inventory',
};

type Cin7SyncButtonProps = {
  entity: Cin7SyncEntity;
  onSynced?: () => void;
  label?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
};

export function Cin7SyncButton({
  entity,
  onSynced,
  label,
  size = 'sm',
  variant = 'outline',
}: Cin7SyncButtonProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    setJustSynced(false);
    try {
      const result = await triggerCin7Sync(entity, { autoResume: true });
      const count = result.records_processed ?? 0;
      const durationSec =
        result.duration_ms != null ? (result.duration_ms / 1000).toFixed(1) : null;
      const partial = result.complete === false;
      toast({
        title: partial
          ? `${ENTITY_LABELS[entity]} sync incomplete`
          : `${ENTITY_LABELS[entity]} synced from Cin7`,
        description: partial
          ? `${count.toLocaleString()} record(s) so far (${durationSec ?? '—'}s). Re-run Sync from Cin7 to resume.`
          : count > 0
            ? `${count.toLocaleString()} record(s) in ${durationSec ?? '—'}s. List refreshed below.`
            : 'Sync completed. No new records were returned from Cin7.',
        variant: partial ? 'destructive' : 'default',
      });
      if (!partial) {
        setJustSynced(true);
        window.setTimeout(() => setJustSynced(false), 2400);
      }
      onSynced?.();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Cin7 sync failed',
        description: error instanceof Error ? error.message : `Could not sync ${entity} from Cin7.`,
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={handleSync} disabled={syncing}>
      <AnimatePresence mode="wait" initial={false}>
        {justSynced ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mr-2 inline-flex"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </motion.span>
        ) : (
          <motion.span
            key="sync"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mr-2 inline-flex"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </motion.span>
        )}
      </AnimatePresence>
      {syncing ? 'Syncing…' : (label ?? 'Sync from Cin7')}
    </Button>
  );
}

type Cin7PageSyncToolbarProps = {
  entity: Cin7SyncEntity;
  onSynced?: () => void;
  showNav?: boolean;
};

export function Cin7PageSyncToolbar({ entity, onSynced }: Cin7PageSyncToolbarProps) {
  const page = getCin7VerifyPage(entity);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="border-border/60 from-muted/40 via-muted/20 relative overflow-hidden rounded-xl border bg-gradient-to-r to-transparent px-4 py-3"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,hsl(var(--primary)/0.08),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-xs">
              Cin7 master data
            </Badge>
            <span className="text-muted-foreground text-xs">Nightly auto-sync · 9:00 PM AEST</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {page?.description ?? 'Pull the latest records from Cin7 Omni.'} Manage credentials and
            reconciliation in{' '}
            <Link
              href={CIN7_INTEGRATIONS_ANCHOR}
              className="text-primary font-medium hover:underline"
            >
              Integrations
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href="/dashboard/inventory/cin7">
              All modules
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href={CIN7_INTEGRATIONS_ANCHOR}>
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </Link>
          </Button>
          <Cin7SyncButton entity={entity} onSynced={onSynced} />
        </div>
      </div>
    </motion.div>
  );
}
