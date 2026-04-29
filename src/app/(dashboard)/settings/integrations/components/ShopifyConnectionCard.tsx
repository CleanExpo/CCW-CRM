'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Unplug,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { ShopifyConnectionStatus } from '@/lib/api/shopify';
import { configureShopify, connectShopify, disconnectShopify } from '@/lib/api/shopify';

const configureSchema = z.object({
  shop_domain: z
    .string()
    .min(1, 'Shop domain is required')
    .regex(/\.myshopify\.com$|^[a-z0-9-]+$/, {
      message: 'Enter your store handle (e.g. my-store) or full domain (my-store.myshopify.com)',
    }),
  access_token: z.string().min(1, 'Access token is required'),
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
});

type ConfigureFormValues = z.infer<typeof configureSchema>;

interface ShopifyConnectionCardProps {
  status: ShopifyConnectionStatus | null;
  loading: boolean;
  onStatusChange: () => void;
}

export function ShopifyConnectionCard({
  status,
  loading,
  onStatusChange,
}: ShopifyConnectionCardProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState(false);

  const isConnected = status?.connected ?? false;
  const isNotConfigured = !status || status.mode === 'not_configured';
  const showForm = isNotConfigured || editingCredentials;

  const form = useForm<ConfigureFormValues>({
    resolver: zodResolver(configureSchema),
    defaultValues: {
      shop_domain: '',
      access_token: '',
      api_key: '',
      api_secret: '',
    },
  });

  const handleSave = async (values: ConfigureFormValues) => {
    setSaving(true);
    try {
      // Normalise domain: add .myshopify.com if just a handle
      const domain = values.shop_domain.includes('.')
        ? values.shop_domain
        : `${values.shop_domain}.myshopify.com`;

      await configureShopify({
        shop_domain: domain,
        access_token: values.access_token,
        api_key: values.api_key || undefined,
        api_secret: values.api_secret || undefined,
      });
      toast({
        title: 'Credentials Saved',
        description: 'Shopify store credentials saved. Click Connect to activate.',
      });
      setEditingCredentials(false);
      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save credentials',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await connectShopify();
      toast({
        title: 'Connected to Shopify',
        description: `Connected to ${response.shop_name || response.shop_domain}`,
      });
      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Shopify',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectShopify();
      toast({ title: 'Disconnected', description: 'Shopify integration disconnected' });
      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Disconnect Failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onStatusChange();
      toast({ title: 'Status Refreshed' });
    } catch {
      toast({ variant: 'destructive', title: 'Refresh Failed' });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-green-600">
                <path d="M16.93 0H7.07a1.2 1.2 0 0 0-1.2 1.2v21.6c0 .66.54 1.2 1.2 1.2h9.86c.66 0 1.2-.54 1.2-1.2V1.2c0-.66-.54-1.2-1.2-1.2zm-4.93 21.9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM16 15H8V3h8v12z" />
              </svg>
            </div>
            <div>
              <CardTitle>Shopify Store</CardTitle>
              <CardDescription>Sync orders and inventory</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {isNotConfigured ? 'Not Configured' : 'Disconnected'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Connected state ── */}
        {isConnected && !editingCredentials && (
          <>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    {status?.shop_name || status?.shop_domain}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">Connected to Shopify store</p>
                </div>
              </div>
            </div>

            {status?.last_order_sync && (
              <div className="text-muted-foreground text-sm">
                Last order sync: {new Date(status.last_order_sync).toLocaleString()}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>

              <Button variant="outline" size="sm" onClick={() => setEditingCredentials(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                Edit Credentials
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={disconnecting}>
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Shopify?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop order imports and inventory sync. Your credentials will be
                      preserved and you can reconnect at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}

        {/* ── Credential form ── */}
        {showForm && (
          <>
            {isNotConfigured && (
              <div className="border-muted-foreground/20 bg-muted/50 flex items-start gap-2 rounded-lg border p-3">
                <AlertCircle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-muted-foreground text-sm">
                  <p className="font-medium">Enter your Shopify store details</p>
                  <p className="mt-1 text-xs">
                    Find your Admin API access token at Shopify Admin → Apps → Develop apps.
                  </p>
                </div>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="shop_domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shop Domain</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="my-store or my-store.myshopify.com"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="access_token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin API Access Token</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="shpat_xxxxxxxxxx..."
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      const raw = form.getValues('shop_domain')?.trim();
                      if (!raw) {
                        toast({
                          variant: 'destructive',
                          title: 'Shop required',
                          description: 'Enter your myshopify.com store handle or domain first.',
                        });
                        return;
                      }
                      const domain = raw.includes('.') ? raw : `${raw}.myshopify.com`;
                      window.location.href = `/api/integrations/shopify/authorize?shop=${encodeURIComponent(domain)}`;
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Authorize with Shopify (OAuth)
                  </Button>
                  <p className="text-muted-foreground text-xs">
                    Uses <code className="bg-muted rounded px-1">SHOPIFY_CLIENT_ID</code> and{' '}
                    <code className="bg-muted rounded px-1">SHOPIFY_API_SECRET</code>. Add the redirect URL{' '}
                    <code className="bg-muted rounded px-1 break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/integrations/shopify/callback` : '/api/integrations/shopify/callback'}
                    </code>{' '}
                    to your Shopify app’s allowed redirect list.
                  </p>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Credentials'}
                  </Button>
                  {editingCredentials && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingCredentials(false)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>

                {!editingCredentials && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={connecting}
                    onClick={handleConnect}
                  >
                    {connecting ? 'Connecting...' : 'Connect'}
                  </Button>
                )}
              </form>
            </Form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
