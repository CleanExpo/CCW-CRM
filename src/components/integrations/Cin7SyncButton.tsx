'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { triggerCin7Sync } from '@/lib/api/cin7';

export type Cin7SyncEntity = 'products' | 'customers' | 'orders' | 'inventory';

const ENTITY_LABELS: Record<Cin7SyncEntity, string> = {
  products: 'Products',
  customers: 'Customers',
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await triggerCin7Sync(entity);
      const count = result.records_processed ?? 0;
      const durationSec =
        result.duration_ms != null ? (result.duration_ms / 1000).toFixed(1) : null;
      toast({
        title: `${ENTITY_LABELS[entity]} synced from Cin7`,
        description:
          count > 0
            ? `${count.toLocaleString()} record(s) in ${durationSec ?? '—'}s. Refresh the list to see updates.`
            : 'Sync completed. No new records were returned from Cin7.',
      });
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
      <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Syncing…' : (label ?? 'Sync from Cin7')}
    </Button>
  );
}

export function Cin7AutoSyncNote() {
  return (
    <p className="text-muted-foreground text-xs leading-relaxed">
      Cin7 auto-sync runs daily at <strong>9:00 PM AEST</strong> (Brisbane). Use{' '}
      <strong>Sync from Cin7</strong> anytime for a manual full pull. Settings → Integrations keeps
      the same controls.
    </p>
  );
}

type Cin7PageSyncToolbarProps = {
  entity: Cin7SyncEntity;
  onSynced?: () => void;
};

export function Cin7PageSyncToolbar({ entity, onSynced }: Cin7PageSyncToolbarProps) {
  return (
    <div className="border-border/60 bg-muted/30 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <Cin7AutoSyncNote />
      <Cin7SyncButton entity={entity} onSynced={onSynced} />
    </div>
  );
}
