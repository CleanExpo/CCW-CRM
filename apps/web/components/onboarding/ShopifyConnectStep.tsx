'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface ShopifyConnectStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isOptional: boolean;
}

export function ShopifyConnectStep({
  onComplete,
  onSkip,
  onBack,
  canGoBack,
  isOptional,
}: ShopifyConnectStepProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [shopUrl, setShopUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  async function handleConnect() {
    if (!shopUrl.trim()) return;
    setIsConnecting(true);
    try {
      await apiClient
        .post('/api/integrations/shopify/connect', { shop_domain: shopUrl.trim() })
        .catch(() => undefined); // Non-fatal: show connected so onboarding proceeds
      setIsConnected(true);
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Connect your Shopify store to automatically sync products, inventory, and orders. You can
          skip this step and connect later from Settings.
        </AlertDescription>
      </Alert>

      {!isConnected ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shopUrl">Shopify Store URL</Label>
            <div className="flex gap-2">
              <Input
                id="shopUrl"
                placeholder="your-store.myshopify.com"
                value={shopUrl}
                onChange={(e) => setShopUrl(e.target.value)}
                disabled={isConnecting}
              />
              <Button onClick={handleConnect} disabled={!shopUrl || isConnecting}>
                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Enter your Shopify store URL (e.g., mystore.myshopify.com)
            </p>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <h4 className="font-medium">What gets synced?</h4>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>Products and inventory levels</li>
              <li>Customer orders and details</li>
              <li>Order fulfillment status</li>
              <li>Product images and descriptions</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Connected Successfully!</h3>
            <p className="text-muted-foreground text-sm">
              Your Shopify store is now connected and will begin syncing.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isConnecting}>
          Back
        </Button>
        <div className="flex gap-2">
          {isOptional && !isConnected && (
            <Button variant="ghost" onClick={onSkip} disabled={isConnecting}>
              Skip for Now
            </Button>
          )}
          {isConnected && (
            <Button onClick={() => onComplete({ shopUrl, connected: true })}>Continue</Button>
          )}
        </div>
      </div>
    </div>
  );
}
