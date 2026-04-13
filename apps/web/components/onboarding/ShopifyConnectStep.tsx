'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, CheckCircle2, BookOpen } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface ShopifyConnectStepProps {
  onComplete: (data?: Record<string, unknown>) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isOptional: boolean;
}

const SHOPIFY_STEPS = [
  'Log into your Shopify Admin',
  'Go to Settings → Apps and sales channels',
  'Click "Develop apps" → "Create an app"',
  'Name it "CCW ERP" → click "Configure Admin API scopes"',
  'Enable: read_products, write_products, read_inventory, write_inventory, read_orders, write_orders',
  'Click "Install app" → copy the Admin API access token (starts with shpat_)',
  'Paste your store domain and the token into the fields below',
];

export function ShopifyConnectStep({
  onComplete,
  onSkip,
  onBack,
  canGoBack,
  isOptional,
}: ShopifyConnectStepProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!shopDomain.trim()) return;
    setIsConnecting(true);
    setError(null);
    try {
      await apiClient.post('/api/integrations/shopify/connect', {
        shop_domain: shopDomain.trim().replace(/^https?:\/\//, ''),
        ...(accessToken.trim() ? { access_token: accessToken.trim() } : {}),
      });
      setIsConnected(true);
    } catch {
      setError('Could not connect. Check your store domain and token, then try again.');
    } finally {
      setIsConnecting(false);
    }
  }

  if (isConnected) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Shopify Connected!</h3>
            <p className="text-muted-foreground text-sm">
              Your products, stock levels, and orders will sync automatically.
            </p>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={() => onComplete({ shopDomain, connected: true })}>Continue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Connecting Shopify syncs your entire product catalogue and current stock levels into the
          ERP. You can skip this and connect later from Settings → Integrations.
        </AlertDescription>
      </Alert>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          What gets synced from Shopify
        </div>
        <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
          <li>All products and SKUs</li>
          <li>Current stock levels (per location)</li>
          <li>Recent orders and fulfilment status</li>
          <li>Product images and descriptions</li>
        </ul>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shopDomain">Shopify Store Domain</Label>
          <Input
            id="shopDomain"
            placeholder="your-store.myshopify.com"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            disabled={isConnecting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accessToken">
            Admin API Access Token{' '}
            <span className="text-muted-foreground font-normal">
              (optional — needed for live sync)
            </span>
          </Label>
          <Input
            id="accessToken"
            type="password"
            placeholder="shpat_xxxxxxxxxxxxxxxx"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            disabled={isConnecting}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-medium"
          onClick={() => setShowInstructions(!showInstructions)}
        >
          <span>How to get your Shopify API token (2 min)</span>
          <Badge variant="outline">{showInstructions ? 'Hide' : 'Show steps'}</Badge>
        </button>
        {showInstructions && (
          <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
            {SHOPIFY_STEPS.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        <a
          href="https://admin.shopify.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex items-center gap-1 text-sm hover:underline"
        >
          Open Shopify Admin <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={!canGoBack || isConnecting}>
          Back
        </Button>
        <div className="flex gap-2">
          {isOptional && (
            <Button variant="ghost" onClick={onSkip} disabled={isConnecting}>
              Skip for Now
            </Button>
          )}
          <Button onClick={handleConnect} disabled={!shopDomain || isConnecting}>
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect Shopify
          </Button>
        </div>
      </div>
    </div>
  );
}
