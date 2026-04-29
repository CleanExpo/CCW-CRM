'use client';

import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { useToast } from '@/hooks/use-toast';
import { getCin7Status, type Cin7ConnectionStatus } from '@/lib/api/cin7';
import { apiClient } from '@/lib/api/client';
import { getSendGridStatus, type SendGridConnectionStatus } from '@/lib/api/sendgrid';
import { getShopifyStatus, type ShopifyConnectionStatus } from '@/lib/api/shopify';
import { getXeroStatus, type XeroConnectionStatus } from '@/lib/api/xero';
import { BookOpen, Bot, CheckCircle2, Globe, Settings, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AP2ConnectionCard } from './components/AP2ConnectionCard';
import { Cin7ConnectionCard } from './components/Cin7ConnectionCard';
import { Cin7ShadowSyncCard } from './components/Cin7ShadowSyncCard';
import { Cin7SyncControls } from './components/Cin7SyncControls';
import { Cin7WebhookSubscriptionsCard } from './components/Cin7WebhookSubscriptionsCard';
import { SendGridConnectionCard } from './components/SendGridConnectionCard';
import { ShopifyConnectionCard } from './components/ShopifyConnectionCard';
import { ShopifySyncControls } from './components/ShopifySyncControls';
import { XeroConnectionCard } from './components/XeroConnectionCard';
import { XeroSyncControls } from './components/XeroSyncControls';

function SectionShell({
  title,
  description,
  children,
  icon,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-sm md:p-6">
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
  const searchParams = useSearchParams();
  const [xeroStatus, setXeroStatus] = useState<XeroConnectionStatus | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyConnectionStatus | null>(null);
  const [sendgridStatus, setSendgridStatus] = useState<SendGridConnectionStatus | null>(null);
  const [cin7Status, setCin7Status] = useState<Cin7ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [geminiStatus, setGeminiStatus] = useState<{
    configured: boolean;
    status: string;
    default_model?: string;
  } | null>(null);
  const [claudeStatus, setClaudeStatus] = useState<{ mode: string; status: string } | null>(null);

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

  const loadAiStatuses = async () => {
    try {
      const [g, c] = await Promise.allSettled([
        apiClient.get<{ configured: boolean; status: string; default_model?: string }>(
          '/api/google-ai/health'
        ),
        apiClient.get<{ mode: string; status: string }>('/api/ai/autonomous/health'),
      ]);
      if (g.status === 'fulfilled') setGeminiStatus(g.value);
      if (c.status === 'fulfilled') setClaudeStatus(c.value);
    } catch {
      // AI services are optional — don't error
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
        loadAiStatuses(),
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

    if (xeroSuccess === 'true') {
      if (tenant) {
        toast({
          title: 'Connected to Xero',
          description: `Successfully connected to ${tenant}`,
        });
      } else {
        toast({ title: 'Connected to Xero', description: 'Your Xero integration is now active' });
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
      <div className="relative flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          aria-hidden="true"
        >
          <div className="from-primary/8 via-background to-background absolute -top-28 left-0 h-72 w-full bg-linear-to-b" />
        </div>

        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-linear-to-br from-card via-card to-muted/40 p-5 shadow-sm md:p-6">
          <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -bottom-12 left-16 h-36 w-36 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/12 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-primary/20">
                <Settings className="text-primary h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Integrations</h1>
                <p className="text-muted-foreground text-sm">
                  Connect your ERP with accounting, inventory, commerce, and AI services.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {[
                { name: 'Xero', ok: xeroStatus?.connected },
                { name: 'Shopify', ok: shopifyStatus?.connected },
                { name: 'SendGrid', ok: sendgridStatus?.connected },
                { name: 'Cin7', ok: cin7Status?.connected },
              ].map((item) => (
                <span
                  key={item.name}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
                    item.ok
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-muted-foreground/20 bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {item.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Integrations Grid */}
        <div className="space-y-6">
          {/* Xero Integration */}
          <SectionShell title="Xero Accounting" description="Sync invoices and payments between ERP and Xero.">
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <XeroConnectionCard
                status={xeroStatus}
                loading={loading}
                onStatusChange={loadXeroStatus}
              />
              <XeroSyncControls isConnected={xeroStatus?.connected ?? false} />
            </div>
          </SectionShell>

          {/* Shopify Integration */}
          <SectionShell title="Shopify E-commerce" description="Manage store connection, order import, and inventory sync.">
            <div className="grid gap-6 md:grid-cols-1">
              <ShopifyConnectionCard
                status={shopifyStatus}
                loading={loading}
                onStatusChange={loadShopifyStatus}
              />
              <ShopifySyncControls isConnected={shopifyStatus?.connected ?? false} />
            </div>
          </SectionShell>

          {/* SendGrid Integration */}
          <SectionShell title="SendGrid Email Management" description="Configure email delivery and outbound communication settings.">
            <div className="grid gap-6 md:grid-cols-1">
              <SendGridConnectionCard
                status={sendgridStatus}
                loading={loading}
                onStatusChange={loadSendGridStatus}
              />
            </div>
          </SectionShell>

          {/* Cin7 Integration */}
          <SectionShell title="Cin7 Inventory Management" description="Connect inventory source, run sync, and monitor webhooks.">
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <Cin7ConnectionCard
                status={cin7Status}
                loading={loading}
                onStatusChange={loadCin7Status}
              />
              <Cin7SyncControls isConnected={cin7Status?.connected ?? false} />
            </div>
            <div className="mt-6">
              <Cin7WebhookSubscriptionsCard />
            </div>
          </SectionShell>

          {/* Cin7 Shadow Sync — gap detection between Cin7 and ERP */}
          <SectionShell
            title="Cin7 Shadow Sync"
            description="Detect and track gaps between Cin7 and the ERP without disrupting live data."
          >
            <Cin7ShadowSyncCard />
          </SectionShell>

          {/* Cin7 Financial / GL Integration */}
          <SectionShell
            title="Cin7 Financial / GL Integration"
            description="Sync Chart of Accounts, manage journal entries and configure ERP-to-GL mappings."
            icon={<BookOpen className="h-4 w-4 text-primary" />}
          >
            <Link href="/settings/integrations/gl">
              <div className="hover:bg-muted/50 hover:border-primary/30 flex cursor-pointer items-center gap-4 rounded-xl border border-border/70 p-4 transition-colors">
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
          </SectionShell>

          {/* Multi-Channel Marketplace */}
          <SectionShell
            title="Multi-Channel Marketplace"
            description="Sync products, inventory, and orders across Shopify, eBay, and Facebook Marketplace."
            icon={<Globe className="h-4 w-4 text-primary" />}
          >
            <Link href="/settings/integrations/marketplace">
              <div className="hover:bg-muted/50 hover:border-primary/30 flex cursor-pointer items-center gap-4 rounded-xl border border-border/70 p-4 transition-colors">
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
          </SectionShell>

          {/* AI Services */}
          <SectionShell title="AI Services" description="Health and mode for AI-backed assistants and automations.">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Google Gemini */}
              <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-xl">✨</span> Google Gemini
                  </div>
                  {geminiStatus?.configured ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-orange-600">
                      <XCircle className="h-3.5 w-3.5" /> Not configured
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  Vision analysis, product attribute extraction, text generation.
                </p>
                {geminiStatus?.default_model && (
                  <p className="mt-1 font-mono text-xs text-blue-600">
                    {geminiStatus.default_model}
                  </p>
                )}
                {!geminiStatus?.configured && (
                  <p className="mt-2 text-xs text-orange-700">
                    Set <code className="bg-muted rounded px-1">GOOGLE_AI_API_KEY</code> in
                    environment variables.
                  </p>
                )}
              </div>
              {/* Anthropic Claude */}
              <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-xl">🤖</span> Anthropic Claude
                  </div>
                  {claudeStatus?.mode === 'production' ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Production
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-blue-600">
                      <Bot className="h-3.5 w-3.5" /> Demo mode
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  Autonomous ops, document extraction, NL queries, staff copilot.
                </p>
                <p className="mt-1 font-mono text-xs text-purple-600">claude-sonnet-4-6</p>
                {claudeStatus?.mode !== 'production' && (
                  <p className="mt-2 text-xs text-blue-700">
                    Set <code className="bg-muted rounded px-1">ANTHROPIC_API_KEY</code> for live AI
                    decisions.
                  </p>
                )}
              </div>
            </div>
          </SectionShell>

          {/* Google AP2 Integration */}
          <SectionShell title="Google Agent Payments (AP2)" description="Configure AP2 connectivity for payment agent workflows.">
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <AP2ConnectionCard />
            </div>
          </SectionShell>
        </div>

      </div>
    </ErrorBoundary>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <div className="rounded-2xl border border-border/60 bg-card p-5 md:p-6">
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
