'use client';

import { useState } from 'react';
import { BarChart3, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  cleanupCin7DuplicateCustomers,
  getCin7Reconciliation,
  type Cin7ReconciliationSnapshot,
} from '@/lib/api/cin7';

type Cin7ReconciliationCardProps = {
  isConnected: boolean;
};

function CountRow({
  label,
  cin7,
  optix,
}: {
  label: string;
  cin7: number | string;
  optix: number | string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        Cin7 {cin7} · Optix {optix}
      </span>
    </div>
  );
}

export function Cin7ReconciliationCard({ isConnected }: Cin7ReconciliationCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [snapshot, setSnapshot] = useState<Cin7ReconciliationSnapshot | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCin7Reconciliation();
      setSnapshot(data);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Reconciliation failed',
        description: error instanceof Error ? error.message : 'Could not load counts',
      });
    } finally {
      setLoading(false);
    }
  };

  const cleanup = async () => {
    setCleaning(true);
    try {
      const data = await cleanupCin7DuplicateCustomers();
      toast({
        title: 'Duplicates cleaned',
        description: `Removed ${data.email_duplicates_removed + data.orphan_no_id_removed} orphan rows. ${data.kept} customers kept.`,
      });
      await load();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Cleanup failed',
        description: error instanceof Error ? error.message : 'Could not clean duplicates',
      });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Master data reconciliation
        </CardTitle>
        <CardDescription>
          Compare live Cin7 counts with Optix after sync. Run before enabling nightly sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!isConnected || loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh counts
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!isConnected || cleaning}
            onClick={() => void cleanup()}
          >
            {cleaning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Remove duplicate customers
          </Button>
        </div>

        {snapshot ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Source: {snapshot.source}</Badge>
              <span className="text-muted-foreground text-xs">
                {new Date(snapshot.checked_at).toLocaleString()}
              </span>
            </div>
            <CountRow
              label="Products (active SKUs)"
              cin7={snapshot.cin7.products.skus}
              optix={snapshot.optix.products.active_cin7_sourced}
            />
            <CountRow
              label="Product styles"
              cin7={snapshot.cin7.products.styles}
              optix={snapshot.optix.products.total}
            />
            <CountRow
              label="CRM customers"
              cin7={snapshot.cin7.customers}
              optix={snapshot.optix.customers.cin7_linked}
            />
            <CountRow
              label="Internal customers"
              cin7={snapshot.cin7.internal_customers}
              optix={snapshot.optix.internal_customers}
            />
            <CountRow
              label="Suppliers"
              cin7={snapshot.cin7.suppliers}
              optix={snapshot.optix.suppliers.cin7_linked}
            />
            <CountRow
              label="Branches"
              cin7={snapshot.cin7.branches}
              optix={snapshot.optix.branches.total}
            />
            {snapshot.optix.customers.unlinked_orphans > 0 ? (
              <p className="text-amber-600 text-xs dark:text-amber-400">
                {snapshot.optix.customers.unlinked_orphans} customer rows have no Cin7 link (likely
                pre-fix duplicates). Use cleanup above.
              </p>
            ) : null}
            {snapshot.notes.map((note) => (
              <p key={note} className="text-muted-foreground text-xs">
                {note}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {isConnected
              ? 'Click refresh to compare Cin7 vs Optix master data counts.'
              : 'Connect Cin7 to run reconciliation.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
