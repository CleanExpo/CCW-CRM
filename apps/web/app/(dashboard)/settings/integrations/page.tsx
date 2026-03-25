'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { XeroConnectionCard } from './components/XeroConnectionCard';
import { XeroSyncControls } from './components/XeroSyncControls';
import { ShopifyConnectionCard } from './components/ShopifyConnectionCard';
import { ShopifySyncControls } from './components/ShopifySyncControls';
import { SendGridConnectionCard } from './components/SendGridConnectionCard';
import { Cin7ConnectionCard } from './components/Cin7ConnectionCard';
import { Cin7SyncControls } from './components/Cin7SyncControls';
import { Cin7WebhookSubscriptionsCard } from './components/Cin7WebhookSubscriptionsCard';
import { AP2ConnectionCard } from './components/AP2ConnectionCard';
import { Cin7ShadowSyncCard } from './components/Cin7ShadowSyncCard';
import { useToast } from '@/hooks/use-toast';
import { getXeroStatus, type XeroConnectionStatus } from '@/lib/api/xero';
import { getShopifyStatus, type ShopifyConnectionStatus } from '@/lib/api/shopify';
import { getSendGridStatus, type SendGridConnectionStatus } from '@/lib/api/sendgrid';
import { getCin7Status, type Cin7ConnectionStatus } from '@/lib/api/cin7';
import { Settings, AlertCircle, BookOpen, Globe } from 'lucide-react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

function IntegrationsContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [xeroStatus, setXeroStatus] = useState<XeroConnectionStatus | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyConnectionStatus | null>(null);
  const [sendgridStatus, setSendgridStatus] = useState<SendGridConnectionStatus | null>(null);
  const [cin7Status, setCin7Status] = useState<Cin7ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadXeroStatus = async () => {
    try {
      const status = await getXeroStatus();
      setXeroStatus(status);
    } catch (error: unknown) {
      console.error('Failed to load Xero status:', error);
      setXeroStatus(null);
    }
  };

  const loadShopifyStatus = async () => {
    try {
      const status = await getShopifyStatus();
      setShopifyStatus(status);
    } catch (error: unknown) {
      console.error('Failed to load Shopify status:', error);
      setShopifyStatus(null);
    }
  };

  const loadSendGridStatus = async () => {
    try {
      const status = await getSendGridStatus();
      setSendgridStatus(status);
    } catch (error: unknown) {
      console.error('Failed to load SendGrid status:', error);
      setSendgridStatus(null);
    }
  };

  const loadCin7Status = async () => {
    try {
      const status = await getCin7Status();
      setCin7Status(status);
    } catch (error: unknown) {
      console.error('Failed to load Cin7 status:', error);
      setCin7Status(null);
    }
  };

  const loadAllStatuses = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadXeroStatus(),
        loadShopifyStatus(),
        loadSendGridStatus(),
        loadCin7Status(),
      ]);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load integration status',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllStatuses();

    // Handle OAuth callback query parameters
    const xeroSuccess = searchParams.get('xero_success');
    const xeroError = searchParams.get('xero_error');
    const tenant = searchParams.get('tenant');
    const mode = searchParams.get('mode');

    if (xeroSuccess === 'true') {
      if (mode === 'demo') {
        toast({
          title: 'Demo Mode Active',
          description: 'Xero integration is running in demo mode (no real API calls)',
        });
      } else if (tenant) {
        toast({
          title: 'Connected to Xero',
          description: `Successfully connected to ${tenant}`,
        });
      } else {
        toast({
          title: 'Connected to Xero',
          description: 'Your Xero integration is now active',
        });
      }

      // Clean up URL
      window.history.replaceState({}, '', '/settings/integrations');
    }

    if (xeroError) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: decodeURIComponent(xeroError),
      });

      // Clean up URL
      window.history.replaceState({}, '', '/settings/integrations');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <ErrorBoundary>
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <Settings className="text-primary h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
              <p className="text-muted-foreground text-sm">
                Connect your ERP with external services
              </p>
            </div>
          </div>
        </div>

        {/* Demo Mode Banner */}
        {((xeroStatus?.mode === 'demo' && xeroStatus?.connected) ||
          (shopifyStatus?.mode === 'demo' && shopifyStatus?.connected) ||
          (sendgridStatus?.mode === 'demo' && sendgridStatus?.connected) ||
          (cin7Status?.mode === 'demo' && cin7Status?.connected)) && (
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
            <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Demo Mode Active
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                {[
                  xeroStatus?.mode === 'demo' && xeroStatus?.connected && 'Xero',
                  shopifyStatus?.mode === 'demo' && shopifyStatus?.connected && 'Shopify',
                  sendgridStatus?.mode === 'demo' && sendgridStatus?.connected && 'SendGrid',
                  cin7Status?.mode === 'demo' && cin7Status?.connected && 'Cin7',
                ]
                  .filter(Boolean)
                  .join(', ')}{' '}
                {[
                  xeroStatus?.mode === 'demo' && xeroStatus?.connected,
                  shopifyStatus?.mode === 'demo' && shopifyStatus?.connected,
                  sendgridStatus?.mode === 'demo' && sendgridStatus?.connected,
                  cin7Status?.mode === 'demo' && cin7Status?.connected,
                ].filter(Boolean).length > 1
                  ? 'integrations are'
                  : 'integration is'}{' '}
                running in demo mode. No real API calls are made. All operations use realistic mock
                data for testing. Switch to live mode when ready by updating your environment
                variables.
              </p>
            </div>
          </div>
        )}

        {/* Integrations Grid */}
        <div className="space-y-8">
          {/* Xero Integration */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Xero Accounting</h2>
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <XeroConnectionCard
                status={xeroStatus}
                loading={loading}
                onStatusChange={loadXeroStatus}
              />
              <XeroSyncControls isConnected={xeroStatus?.connected ?? false} />
            </div>
          </div>

          {/* Shopify Integration */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Shopify E-commerce</h2>
            <div className="grid gap-6 md:grid-cols-1">
              <ShopifyConnectionCard
                status={shopifyStatus}
                loading={loading}
                onStatusChange={loadShopifyStatus}
              />
              <ShopifySyncControls isConnected={shopifyStatus?.connected ?? false} />
            </div>
          </div>

          {/* SendGrid Integration */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">SendGrid Email Management</h2>
            <div className="grid gap-6 md:grid-cols-1">
              <SendGridConnectionCard
                status={sendgridStatus}
                loading={loading}
                onStatusChange={loadSendGridStatus}
              />
            </div>
          </div>

          {/* Cin7 Integration */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Cin7 Inventory Management</h2>
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <Cin7ConnectionCard
                status={cin7Status}
                loading={loading}
                onStatusChange={loadCin7Status}
              />
              <Cin7SyncControls isConnected={cin7Status?.connected ?? false} />
            </div>
            <Cin7WebhookSubscriptionsCard />
          </div>

          {/* Cin7 Shadow Sync — gap detection between Cin7 and ERP */}
          <div>
            <h2 className="mb-1 text-lg font-semibold">Cin7 Shadow Sync</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Detect and track gaps between Cin7 and the ERP without disrupting live data.
            </p>
            <Cin7ShadowSyncCard />
          </div>

          {/* Cin7 Financial / GL Integration */}
          <div>
            <h2 className="mb-1 text-lg font-semibold">Cin7 Financial / GL Integration</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Sync Chart of Accounts, manage journal entries and configure ERP-to-GL account
              mappings.
            </p>
            <Link href="/settings/integrations/gl">
              <div className="hover:bg-muted/50 flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  <BookOpen className="text-primary h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Financial / GL Settings</p>
                  <p className="text-muted-foreground text-xs">
                    Chart of Accounts, journal entries and account mappings
                  </p>
                </div>
                <span className="text-muted-foreground text-sm">View GL Settings →</span>
              </div>
            </Link>
          </div>

          {/* Multi-Channel Marketplace */}
          <div>
            <h2 className="mb-1 text-lg font-semibold">Multi-Channel Marketplace</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Sync products, inventory, and orders across Shopify, eBay, and Facebook Marketplace.
            </p>
            <Link href="/settings/integrations/marketplace">
              <div className="hover:bg-muted/50 flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Globe className="text-primary h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Marketplace Dashboard</p>
                  <p className="text-muted-foreground text-xs">
                    Connect channels, sync products, and view unified orders
                  </p>
                </div>
                <span className="text-muted-foreground text-sm">Open Dashboard →</span>
              </div>
            </Link>
          </div>

          {/* Google AP2 Integration */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Google Agent Payments (AP2)</h2>
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <AP2ConnectionCard />
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="mt-6">
          <h2 className="mb-4 text-lg font-semibold">Coming Soon</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'QuickBooks',
                description: 'Alternative accounting software',
                icon: '📊',
              },
            ].map((integration) => (
              <div
                key={integration.name}
                className="flex items-center gap-3 rounded-lg border border-dashed p-4 opacity-50"
              >
                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg text-2xl">
                  {integration.icon}
                </div>
                <div>
                  <p className="font-medium">{integration.name}</p>
                  <p className="text-muted-foreground text-xs">{integration.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Settings className="text-primary h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
                <p className="text-muted-foreground text-sm">Loading integration status...</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}
