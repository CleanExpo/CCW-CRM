'use client';

import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getCin7Status, type Cin7ConnectionStatus } from '@/lib/api/cin7';
import { getSendGridStatus, type SendGridConnectionStatus } from '@/lib/api/sendgrid';
import { getShopifyStatus, type ShopifyConnectionStatus } from '@/lib/api/shopify';
import { getXeroStatus, type XeroConnectionStatus } from '@/lib/api/xero';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronDown, Settings, XCircle } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Cin7ConnectionCard } from './components/Cin7ConnectionCard';
import { Cin7ReconciliationCard } from './components/Cin7ReconciliationCard';
import { Cin7ShadowSyncCard } from './components/Cin7ShadowSyncCard';
import { Cin7SyncControls } from './components/Cin7SyncControls';
import { Cin7WebhookSubscriptionsCard } from './components/Cin7WebhookSubscriptionsCard';
import { IntegrationsSetupGuide } from './components/IntegrationsSetupGuide';
import { SendGridConnectionCard } from './components/SendGridConnectionCard';
import { ShopifyConnectionCard } from './components/ShopifyConnectionCard';
import { ShopifySyncControls } from './components/ShopifySyncControls';
import { UpcomingIntegrationSecretsForm } from './components/UpcomingIntegrationSecretsForm';
import { XeroConnectionCard } from './components/XeroConnectionCard';
import { XeroSyncControls } from './components/XeroSyncControls';

function SectionShell({
  sectionId,
  title,
  description,
  children,
  icon,
}: {
  sectionId?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section
      id={sectionId}
      className={cn(
        'border-border/60 bg-card/70 scroll-mt-24 rounded-2xl border p-5 shadow-sm backdrop-blur-sm md:p-6'
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {icon}
            {title}
          </h2>
          {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function IntegrationsContent() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'setup' ? 'setup' : 'connections';

  const setTab = (next: 'connections' | 'setup') => {
    const p = new URLSearchParams(searchParams.toString());
    if (next === 'setup') p.set('tab', 'setup');
    else p.delete('tab');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const goToConnections = (sectionId?: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('tab');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (sectionId) {
          document
            .getElementById(sectionId)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  };
  const [xeroStatus, setXeroStatus] = useState<XeroConnectionStatus | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyConnectionStatus | null>(null);
  const [sendgridStatus, setSendgridStatus] = useState<SendGridConnectionStatus | null>(null);
  const [cin7Status, setCin7Status] = useState<Cin7ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cin7ExtrasOpen, setCin7ExtrasOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const initialLoadDone = useRef(false);
  const oauthHandled = useRef(false);

  const loadXeroStatus = useCallback(async () => {
    try {
      const status = await getXeroStatus();
      setXeroStatus(status);
    } catch (error: unknown) {
      console.error('Failed to load Xero status:', error);
      setXeroStatus(null);
    }
  }, []);

  const loadShopifyStatus = useCallback(async () => {
    try {
      const status = await getShopifyStatus();
      setShopifyStatus(status);
    } catch (error: unknown) {
      console.error('Failed to load Shopify status:', error);
      setShopifyStatus(null);
    }
  }, []);

  const loadSendGridStatus = useCallback(async () => {
    try {
      const status = await getSendGridStatus();
      setSendgridStatus(status);
    } catch (error: unknown) {
      console.error('Failed to load SendGrid status:', error);
      setSendgridStatus(null);
    }
  }, []);

  const loadCin7Status = useCallback(async (options?: { verify?: boolean }) => {
    try {
      const status = await getCin7Status({ verify: options?.verify });
      setCin7Status(status);
      return status;
    } catch (error: unknown) {
      console.error('Failed to load Cin7 status:', error);
      setCin7Status(null);
      throw error;
    }
  }, []);

  const loadAllStatuses = useCallback(async () => {
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
  }, [loadCin7Status, loadSendGridStatus, loadShopifyStatus, loadXeroStatus, toast]);

  // Single initial status load (Strict Mode / remount safe via getCin7Status dedupe + this ref).
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    void loadAllStatuses();
  }, [loadAllStatuses]);

  // OAuth callback query params — do not re-fetch all statuses on every searchParams change.
  useEffect(() => {
    if (oauthHandled.current) return;

    const xeroSuccess = searchParams.get('xero_success');
    const xeroError = searchParams.get('xero_error');
    const tenant = searchParams.get('tenant');
    const shopifySuccess = searchParams.get('shopify_success');
    const shopifyError = searchParams.get('shopify_error');

    if (!xeroSuccess && !xeroError && !shopifySuccess && !shopifyError) return;
    oauthHandled.current = true;

    if (shopifySuccess === '1') {
      toast({
        title: 'Shopify connected',
        description: 'You can verify status and run sync from this page.',
      });
      void loadShopifyStatus();
      window.history.replaceState({}, '', '/dashboard/settings/integrations');
    }

    if (shopifyError) {
      toast({
        variant: 'destructive',
        title: 'Shopify connection failed',
        description: decodeURIComponent(shopifyError),
      });
      window.history.replaceState({}, '', '/dashboard/settings/integrations');
    }

    if (xeroSuccess === 'true') {
      if (tenant) {
        toast({
          title: 'Connected to Xero',
          description: `Successfully connected to ${tenant}`,
        });
      } else {
        toast({ title: 'Connected to Xero', description: 'Your Xero integration is now active' });
      }
      void loadXeroStatus();
      window.history.replaceState({}, '', '/dashboard/settings/integrations');
    }

    if (xeroError) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: decodeURIComponent(xeroError),
      });
      window.history.replaceState({}, '', '/dashboard/settings/integrations');
    }
  }, [searchParams, toast, loadShopifyStatus, loadXeroStatus]);

  const cin7Connected = cin7Status?.connected ?? false;

  return (
    <ErrorBoundary>
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="border-border/60 bg-card rounded-xl border p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Settings className="text-primary h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Integrations</h1>
                <p className="text-muted-foreground text-sm">
                  Connect Cin7, Xero, Shopify, and SendGrid. Other services are listed under
                  Upcoming.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {[
                { name: 'Cin7', ok: cin7Connected },
                { name: 'Xero', ok: xeroStatus?.connected },
                { name: 'Shopify', ok: shopifyStatus?.connected },
                { name: 'SendGrid', ok: sendgridStatus?.can_send ?? sendgridStatus?.connected },
              ].map((item) => (
                <span
                  key={item.name}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
                    item.ok
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-muted-foreground/20 bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {item.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setTab(v === 'setup' ? 'setup' : 'connections')}
          className="w-full"
        >
          <TabsList className="grid w-full max-w-md grid-cols-2 sm:w-auto">
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="setup">Setup guide</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="mt-6">
            <IntegrationsSetupGuide
              xeroStatus={xeroStatus}
              shopifyStatus={shopifyStatus}
              sendgridStatus={sendgridStatus}
              cin7Status={cin7Status}
              loading={loading}
              onGoToConnections={goToConnections}
              onRefreshStatuses={loadAllStatuses}
            />
          </TabsContent>

          <TabsContent value="connections" className="mt-6 space-y-6">
            <SectionShell
              sectionId="integration-cin7"
              title="Cin7"
              description="Inventory from Cin7 Omni (read-only pulls)."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <Cin7ConnectionCard
                  status={cin7Status}
                  loading={loading}
                  onStatusChange={loadCin7Status}
                />
                <Cin7SyncControls isConnected={cin7Connected} />
              </div>
              <Cin7ReconciliationCard isConnected={cin7Connected} />
              <details
                className="border-border/60 bg-muted/20 group mt-4 rounded-lg border"
                onToggle={(e) => setCin7ExtrasOpen((e.target as HTMLDetailsElement).open)}
              >
                <summary className="text-muted-foreground cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2">
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    More Cin7 (webhooks, shadow sync)
                  </span>
                </summary>
                {cin7ExtrasOpen ? (
                  <div className="border-border/60 space-y-4 border-t px-4 pt-2 pb-4">
                    <Cin7WebhookSubscriptionsCard />
                    <Cin7ShadowSyncCard />
                  </div>
                ) : null}
              </details>
            </SectionShell>

            <SectionShell
              sectionId="integration-xero"
              title="Xero"
              description="Accounting and invoices."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <XeroConnectionCard
                  status={xeroStatus}
                  loading={loading}
                  onStatusChange={loadXeroStatus}
                />
                <XeroSyncControls isConnected={xeroStatus?.connected ?? false} />
              </div>
            </SectionShell>

            <SectionShell
              sectionId="integration-shopify"
              title="Shopify"
              description="Store, orders, and inventory."
            >
              <div className="grid gap-6">
                <ShopifyConnectionCard
                  status={shopifyStatus}
                  loading={loading}
                  onStatusChange={loadShopifyStatus}
                />
                <ShopifySyncControls isConnected={shopifyStatus?.connected ?? false} />
              </div>
            </SectionShell>

            <SectionShell
              sectionId="integration-sendgrid"
              title="SendGrid"
              description="Transactional and marketing email."
            >
              <SendGridConnectionCard
                status={sendgridStatus}
                loading={loading}
                onStatusChange={loadSendGridStatus}
              />
            </SectionShell>

            <details
              className="border-muted-foreground/30 bg-muted/10 group rounded-xl border border-dashed"
              onToggle={(e) => setUpcomingOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  Upcoming (not wired for production yet)
                </span>
              </summary>
              {upcomingOpen ? (
                <div className="border-border/40 space-y-4 border-t px-4 py-4 text-sm leading-relaxed">
                  <p className="text-muted-foreground text-xs">
                    Save API keys below; they are stored in the database for this workspace. Product
                    features for Gemini, Claude, HeyGen, and AP2 are still upcoming — keys are kept
                    here until those flows go live.
                  </p>
                  <UpcomingIntegrationSecretsForm />
                </div>
              ) : null}
            </details>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <div className="border-border/60 bg-card rounded-2xl border p-5 md:p-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Settings className="text-primary h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
                <p className="text-muted-foreground text-sm">Loading…</p>
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
