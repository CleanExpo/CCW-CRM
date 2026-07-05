'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Cin7SyncButton, type Cin7SyncEntity } from '@/components/integrations/Cin7SyncButton';
import { CIN7_INTEGRATIONS_ANCHOR } from '@/lib/integrations/cin7-master-data-routes';

type Cin7EmptyStateProps = {
  entity: Cin7SyncEntity;
  title: string;
  description: string;
  icon: LucideIcon;
  onSynced?: () => void;
};

export function Cin7EmptyState({
  entity,
  title,
  description,
  icon: Icon,
  onSynced,
}: Cin7EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="border-border/60 flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-primary/15 to-transparent">
        <Icon className="text-primary h-7 w-7" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Cin7SyncButton entity={entity} onSynced={onSynced} label="Sync from Cin7" />
        <Button variant="ghost" size="sm" asChild>
          <Link href={CIN7_INTEGRATIONS_ANCHOR}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Open integrations
          </Link>
        </Button>
      </div>
      <Button variant="link" size="sm" className="mt-4 text-xs" asChild>
        <Link href="/dashboard/inventory/cin7">
          View all Cin7 modules
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </motion.div>
  );
}
