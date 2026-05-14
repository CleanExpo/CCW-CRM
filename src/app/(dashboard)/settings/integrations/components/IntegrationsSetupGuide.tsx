'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ExternalLink, Loader2, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import type { Cin7ConnectionStatus } from '@/lib/api/cin7';
import type { SendGridConnectionStatus } from '@/lib/api/sendgrid';
import type { ShopifyConnectionStatus } from '@/lib/api/shopify';
import type { XeroConnectionStatus } from '@/lib/api/xero';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { ShadowOnboardingFlow } from './ShadowOnboardingFlow';

type Props = {
  xeroStatus: XeroConnectionStatus | null;
  shopifyStatus: ShopifyConnectionStatus | null;
  sendgridStatus: SendGridConnectionStatus | null;
  cin7Status: Cin7ConnectionStatus | null;
  loading: boolean;
  onGoToConnections: (sectionId?: string) => void;
  onRefreshStatuses: () => void;
};

type CheckRow = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void;
};

export function IntegrationsSetupGuide({
  xeroStatus,
  shopifyStatus,
  sendgridStatus,
  cin7Status,
  loading,
  onGoToConnections,
  onRefreshStatuses,
}: Props) {
  const { toast } = useToast();
  const [syncingProducts, setSyncingProducts] = useState(false);

  async function runProductSync() {
    if (!cin7Status?.connected) {
      onGoToConnections('integration-cin7');
      return;
    }
    setSyncingProducts(true);
    try {
      await apiClient.post('/api/integrations/cin7/sync/products');
      toast({ title: 'Sync started', description: 'Cin7 products sync has been requested.' });
      onRefreshStatuses();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: e instanceof Error ? e.message : 'Could not start Cin7 product sync.',
      });
    } finally {
      setSyncingProducts(false);
    }
  }

  const rows: CheckRow[] = [
    {
      id: 'xero',
      title: 'Connect accounting (Xero)',
      description: 'OAuth to Xero for invoices, payments, and GL alignment.',
      done: !!xeroStatus?.connected,
      actionLabel: xeroStatus?.connected ? 'Review connection' : 'Configure Xero',
      onAction: () => onGoToConnections('integration-xero'),
    },
    {
      id: 'cin7',
      title: 'Connect inventory (Cin7)',
      description: 'Pull products, stock, and customers from Cin7 Omni (or Core if configured).',
      done: !!cin7Status?.connected,
      actionLabel: cin7Status?.connected ? 'Review connection' : 'Configure Cin7',
      onAction: () => onGoToConnections('integration-cin7'),
    },
    {
      id: 'shopify',
      title: 'Connect storefront (Shopify)',
      description: 'Optional: import orders and push inventory to your Shopify store.',
      done: !!shopifyStatus?.connected,
      actionLabel: shopifyStatus?.connected ? 'Review connection' : 'Configure Shopify',
      onAction: () => onGoToConnections('integration-shopify'),
    },
    {
      id: 'sendgrid',
      title: 'Configure email (SendGrid)',
      description: 'Outbound email for notifications and customer comms.',
      done: !!sendgridStatus?.connected,
      actionLabel: sendgridStatus?.connected ? 'Review connection' : 'Configure SendGrid',
      onAction: () => onGoToConnections('integration-sendgrid'),
    },
  ];

  const completedCore = [cin7Status?.connected, xeroStatus?.connected].filter(Boolean).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Setup guide</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Work through the four integrations below, then open <strong>Connections</strong> for sync
          controls and optional Cin7 tools.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">
            Core connections: {completedCore}/2 recommended minimum
          </span>
          <Button variant="outline" size="sm" onClick={onRefreshStatuses} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Refresh status</span>
          </Button>
        </div>
      </div>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex gap-4 rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm"
          >
            <div className="pt-0.5">
              {row.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
              ) : (
                <Circle className="text-muted-foreground h-5 w-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{row.title}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">{row.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant={row.done ? 'outline' : 'default'} onClick={row.onAction}>
                  {row.actionLabel}
                  <ExternalLink className="ml-1 h-3.5 w-3.5 opacity-70" />
                </Button>
                {row.id === 'cin7' && cin7Status?.connected && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={runProductSync}
                    disabled={syncingProducts}
                  >
                    {syncingProducts ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Run product sync'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="flex items-center gap-2 font-medium">
          <Users className="h-4 w-4" />
          Team & company
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Invite colleagues and set company details — separate from integration credentials.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/settings/team">Team & invites</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/settings/company">Company profile</Link>
          </Button>
        </div>
      </div>

      <ShadowOnboardingFlow />
    </div>
  );
}
