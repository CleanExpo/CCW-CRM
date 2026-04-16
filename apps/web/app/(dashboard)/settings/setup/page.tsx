'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'connected' | 'checking' | 'error';
  href?: string;
  externalLink?: string;
  errorMessage?: string;
}

export default function SetupPage() {
  const { toast } = useToast();
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'cin7',
      title: 'Connect Cin7 (Inventory & Products)',
      description:
        'Enter your Cin7 Core Account ID and Application Key to sync products, customers, orders, and inventory.',
      status: 'pending',
      href: '/settings/integrations',
      externalLink: 'https://inventory.dearsystems.com/Integration#apikeys',
    },
    {
      id: 'xero',
      title: 'Connect Xero (Accounting)',
      description:
        'Authorise your Xero account to sync invoices, contacts, and payments automatically.',
      status: 'pending',
      href: '/settings/integrations',
      externalLink: 'https://developer.xero.com/app/manage',
    },
    {
      id: 'shopify',
      title: 'Connect Shopify (E-commerce)',
      description:
        'Enter your Shopify store domain and access token to sync online orders and product listings.',
      status: 'pending',
      href: '/settings/integrations',
      externalLink: 'https://admin.shopify.com/store',
    },
  ]);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<Record<string, number> | null>(null);

  const checkConnections = useCallback(async () => {
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'checking' as const })));

    // Check Cin7
    try {
      const cin7Status = await apiClient.get<{ connected: boolean; mode: string }>(
        '/api/integrations/cin7/status'
      );
      setSteps((prev) =>
        prev.map((s) =>
          s.id === 'cin7'
            ? {
                ...s,
                status: cin7Status.connected ? 'connected' : 'pending',
              }
            : s
        )
      );
    } catch {
      setSteps((prev) => prev.map((s) => (s.id === 'cin7' ? { ...s, status: 'pending' } : s)));
    }

    // Check Xero
    try {
      const xeroStatus = await apiClient.get<{ connected: boolean }>(
        '/api/integrations/xero/status'
      );
      setSteps((prev) =>
        prev.map((s) =>
          s.id === 'xero'
            ? {
                ...s,
                status: xeroStatus.connected ? 'connected' : 'pending',
              }
            : s
        )
      );
    } catch {
      setSteps((prev) => prev.map((s) => (s.id === 'xero' ? { ...s, status: 'pending' } : s)));
    }

    // Check Shopify
    try {
      const shopifyStatus = await apiClient.get<{ connected: boolean }>(
        '/api/integrations/shopify/status'
      );
      setSteps((prev) =>
        prev.map((s) =>
          s.id === 'shopify'
            ? {
                ...s,
                status: shopifyStatus.connected ? 'connected' : 'pending',
              }
            : s
        )
      );
    } catch {
      setSteps((prev) => prev.map((s) => (s.id === 'shopify' ? { ...s, status: 'pending' } : s)));
    }
  }, []);

  useEffect(() => {
    checkConnections();
  }, [checkConnections]);

  const connectedCount = steps.filter((s) => s.status === 'connected').length;
  const allConnected = connectedCount === steps.length;

  const runInitialSync = async () => {
    setSyncing(true);
    setSyncResults(null);
    try {
      const result = await apiClient.post<{
        results: Record<string, { success: boolean; data?: { synced?: number } }>;
      }>('/api/cron/nightly-full-sync');

      const counts: Record<string, number> = {};
      if (result.results) {
        for (const [key, val] of Object.entries(result.results)) {
          if (val.success && val.data && typeof val.data === 'object' && 'synced' in val.data) {
            counts[key] = (val.data as { synced: number }).synced;
          }
        }
      }

      setSyncResults(counts);
      toast({
        title: 'Initial sync complete',
        description: `Synced data from ${Object.keys(counts).length} sources.`,
      });
    } catch (error) {
      toast({
        title: 'Sync error',
        description: error instanceof Error ? error.message : 'Failed to run initial sync',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CCW System Setup</h1>
        <p className="text-muted-foreground mt-2">
          Connect your business systems to start syncing live data. Your data will sync
          automatically every night at 11pm AEST.
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Setup Progress</CardTitle>
          <CardDescription>
            {allConnected
              ? "All systems connected! You're ready to go."
              : `${connectedCount} of ${steps.length} systems connected`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-2.5 w-full rounded-full">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${(connectedCount / steps.length) * 100}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card
            key={step.id}
            className={
              step.status === 'connected'
                ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                : ''
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {step.status === 'checking' ? (
                    <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                  ) : step.status === 'connected' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="text-muted-foreground h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      Step {index + 1}: {step.title}
                    </CardTitle>
                    {step.status === 'connected' && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      >
                        Connected
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">{step.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pl-11">
              <div className="flex gap-2">
                {step.href && step.status !== 'connected' && (
                  <Button variant="default" size="sm" asChild>
                    <a href={step.href}>Configure</a>
                  </Button>
                )}
                {step.externalLink && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={step.externalLink} target="_blank" rel="noopener noreferrer">
                      Get API Keys
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                )}
                {step.status === 'connected' && step.href && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={step.href}>Manage</a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Initial Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Initial Data Sync</CardTitle>
          <CardDescription>
            Once your integrations are connected, run an initial sync to pull all your existing data
            into CCW. After this, data syncs automatically every night at 11:00 PM AEST.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={runInitialSync}
            disabled={syncing || connectedCount === 0}
            className="w-full"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Initial Sync
              </>
            )}
          </Button>
          {connectedCount === 0 && (
            <p className="text-muted-foreground text-center text-sm">
              Connect at least one integration above to enable sync.
            </p>
          )}
          {syncResults && Object.keys(syncResults).length > 0 && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Sync Results:</p>
              {Object.entries(syncResults).map(([key, count]) => (
                <div key={key} className="text-muted-foreground flex justify-between text-sm">
                  <span>{key.replace(/_/g, ' ')}</span>
                  <span className="font-mono">{count} records</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refresh status */}
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={checkConnections}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Refresh connection status
        </Button>
      </div>
    </div>
  );
}
