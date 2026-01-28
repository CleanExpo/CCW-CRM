"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { XeroConnectionCard } from "./components/XeroConnectionCard";
import { XeroSyncControls } from "./components/XeroSyncControls";
import { ShopifyConnectionCard } from "./components/ShopifyConnectionCard";
import { ShopifySyncControls } from "./components/ShopifySyncControls";
import { SendGridConnectionCard } from "./components/SendGridConnectionCard";
import { useToast } from "@/hooks/use-toast";
import { getXeroStatus, type XeroConnectionStatus } from "@/lib/api/xero";
import { getShopifyStatus, type ShopifyConnectionStatus } from "@/lib/api/shopify";
import { getSendGridStatus, type SendGridConnectionStatus } from "@/lib/api/sendgrid";
import { Settings, AlertCircle } from "lucide-react";

function IntegrationsContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [xeroStatus, setXeroStatus] = useState<XeroConnectionStatus | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyConnectionStatus | null>(null);
  const [sendgridStatus, setSendgridStatus] = useState<SendGridConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadXeroStatus = async () => {
    try {
      const status = await getXeroStatus();
      setXeroStatus(status);
    } catch (error: unknown) {
      console.error("Failed to load Xero status:", error);
      setXeroStatus(null);
    }
  };

  const loadShopifyStatus = async () => {
    try {
      const status = await getShopifyStatus();
      setShopifyStatus(status);
    } catch (error: unknown) {
      console.error("Failed to load Shopify status:", error);
      setShopifyStatus(null);
    }
  };

  const loadSendGridStatus = async () => {
    try {
      const status = await getSendGridStatus();
      setSendgridStatus(status);
    } catch (error: unknown) {
      console.error("Failed to load SendGrid status:", error);
      setSendgridStatus(null);
    }
  };

  const loadAllStatuses = async () => {
    setLoading(true);
    try {
      await Promise.all([loadXeroStatus(), loadShopifyStatus(), loadSendGridStatus()]);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load integration status",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllStatuses();

    // Handle OAuth callback query parameters
    const xeroSuccess = searchParams.get("xero_success");
    const xeroError = searchParams.get("xero_error");
    const tenant = searchParams.get("tenant");
    const mode = searchParams.get("mode");

    if (xeroSuccess === "true") {
      if (mode === "demo") {
        toast({
          title: "Demo Mode Active",
          description: "Xero integration is running in demo mode (no real API calls)",
        });
      } else if (tenant) {
        toast({
          title: "Connected to Xero",
          description: `Successfully connected to ${tenant}`,
        });
      } else {
        toast({
          title: "Connected to Xero",
          description: "Your Xero integration is now active",
        });
      }

      // Clean up URL
      window.history.replaceState({}, "", "/settings/integrations");
    }

    if (xeroError) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: decodeURIComponent(xeroError),
      });

      // Clean up URL
      window.history.replaceState({}, "", "/settings/integrations");
    }
  }, [searchParams]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
            <p className="text-sm text-muted-foreground">
              Connect your ERP with external services
            </p>
          </div>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {((xeroStatus?.mode === "demo" && xeroStatus?.connected) ||
        (shopifyStatus?.mode === "demo" && shopifyStatus?.connected) ||
        (sendgridStatus?.mode === "demo" && sendgridStatus?.connected)) && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Demo Mode Active
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              {[
                xeroStatus?.mode === "demo" && xeroStatus?.connected && "Xero",
                shopifyStatus?.mode === "demo" && shopifyStatus?.connected && "Shopify",
                sendgridStatus?.mode === "demo" && sendgridStatus?.connected && "SendGrid",
              ]
                .filter(Boolean)
                .join(", ")}{" "}
              {[
                xeroStatus?.mode === "demo" && xeroStatus?.connected,
                shopifyStatus?.mode === "demo" && shopifyStatus?.connected,
                sendgridStatus?.mode === "demo" && sendgridStatus?.connected,
              ].filter(Boolean).length > 1
                ? "integrations are"
                : "integration is"}{" "}
              running in demo mode. No real API calls are made. All operations use realistic mock data for testing.
              Switch to live mode when ready by updating your environment configuration.
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
            <XeroConnectionCard status={xeroStatus} loading={loading} onStatusChange={loadXeroStatus} />
            <XeroSyncControls isConnected={xeroStatus?.connected ?? false} />
          </div>
        </div>

        {/* Shopify Integration */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Shopify E-commerce</h2>
          <div className="grid gap-6 md:grid-cols-1">
            <ShopifyConnectionCard status={shopifyStatus} loading={loading} onStatusChange={loadShopifyStatus} />
            <ShopifySyncControls isConnected={shopifyStatus?.connected ?? false} />
          </div>
        </div>

        {/* SendGrid Integration */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">SendGrid Email Management</h2>
          <div className="grid gap-6 md:grid-cols-1">
            <SendGridConnectionCard status={sendgridStatus} loading={loading} onStatusChange={loadSendGridStatus} />
          </div>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div className="mt-6">
        <h2 className="mb-4 text-lg font-semibold">Coming Soon</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              name: "QuickBooks",
              description: "Alternative accounting software",
              icon: "📊",
            },
            {
              name: "Stripe",
              description: "Payment processing integration",
              icon: "💳",
            },
          ].map((integration) => (
            <div
              key={integration.name}
              className="flex items-center gap-3 rounded-lg border border-dashed p-4 opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-2xl">
                {integration.icon}
              </div>
              <div>
                <p className="font-medium">{integration.name}</p>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
              <p className="text-sm text-muted-foreground">
                Loading integration status...
              </p>
            </div>
          </div>
        </div>
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  );
}
