'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  CheckCircle2,
  Globe,
  Loader2,
  Package,
  Plug,
  RefreshCw,
  ShoppingCart,
  Unplug,
  Warehouse,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import {
  type ChannelInfo,
  type MarketplaceOrder,
  type ProductListing,
  type SyncStatusChannel,
  marketplaceApi,
} from '@/lib/api/marketplace';

// ─── Channel icon + colour mapping ──────────────────────────────────

const CHANNEL_META: Record<string, { icon: string; color: string }> = {
  shopify: {
    icon: '🟢',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  ebay: { icon: '🔵', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  facebook: {
    icon: '🟣',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
};

function channelBadge(channelType: string) {
  const meta = CHANNEL_META[channelType] || { icon: '⚪', color: 'bg-gray-100 text-gray-800' };
  return (
    <Badge variant="outline" className={`${meta.color} gap-1`}>
      <span>{meta.icon}</span>
      {channelType}
    </Badge>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncStatusChannel>>({});
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingInventory, setSyncingInventory] = useState(false);

  // Setup wizard state
  const [setupChannel, setSetupChannel] = useState<ChannelInfo | null>(null);
  const [setupCreds, setSetupCreds] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);

  // Products view
  const [viewProducts, setViewProducts] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [channelRes, statusRes, orderRes] = await Promise.all([
        marketplaceApi.getChannels(),
        marketplaceApi.getSyncStatus(),
        marketplaceApi.getOrders(),
      ]);
      setChannels(channelRes.channels);
      setSyncStatus(statusRes.channels);
      setOrders(orderRes.orders);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load marketplace data',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Connect / Disconnect ─────────────────────────────────────────

  const handleConnect = async () => {
    if (!setupChannel) return;
    setConnecting(true);
    try {
      const res = await marketplaceApi.connect(setupChannel.channel_type, setupCreds);
      if (res.success) {
        toast({ title: 'Connected', description: res.message });
        setSetupChannel(null);
        setSetupCreds({});
        await loadData();
      } else {
        toast({ variant: 'destructive', title: 'Failed', description: res.message });
      }
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (channelType: string) => {
    try {
      await marketplaceApi.disconnect(channelType);
      toast({ title: 'Disconnected', description: `${channelType} has been disconnected.` });
      await loadData();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect',
      });
    }
  };

  // ─── Sync actions ─────────────────────────────────────────────────

  const handleSyncProducts = async () => {
    setSyncing(true);
    try {
      const res = await marketplaceApi.syncProducts();
      if (res.success) {
        const totalPushed = Object.values(res.results).reduce((s, r) => s + (r.pushed || 0), 0);
        toast({
          title: 'Products Synced',
          description: `${totalPushed} products pushed across ${Object.keys(res.results).length} channels.`,
        });
      }
      await loadData();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Product sync failed',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncInventory = async () => {
    setSyncingInventory(true);
    try {
      const res = await marketplaceApi.syncInventory();
      if (res.success) {
        const totalSynced = Object.values(res.results).reduce((s, r) => s + (r.synced || 0), 0);
        toast({
          title: 'Inventory Synced',
          description: `${totalSynced} items synced across channels.`,
        });
      }
      await loadData();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Inventory sync failed',
      });
    } finally {
      setSyncingInventory(false);
    }
  };

  // ─── View channel products ────────────────────────────────────────

  const handleViewProducts = async (channelType: string) => {
    setViewProducts(channelType);
    setLoadingProducts(true);
    try {
      const prods = await marketplaceApi.getProducts(channelType);
      setProducts(prods);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  const connectedCount = channels.filter((c) => c.connected).length;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings/integrations" className="hover:bg-muted rounded-md p-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <Globe className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Marketplace Channels</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Manage multi-channel product listings, inventory, and orders
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Demo mode banner */}
      {channels.some((c) => c.mode === 'demo') && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <strong>Demo Mode</strong> — All channels are running with mock data. Connect with real
          credentials when ready.
        </div>
      )}

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList>
          <TabsTrigger value="channels">Channels ({channels.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="sync">Sync Status</TabsTrigger>
        </TabsList>

        {/* ─── Channels Tab ─────────────────────────────────────────── */}
        <TabsContent value="channels" className="space-y-4">
          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSyncProducts}
              disabled={syncing || connectedCount === 0}
              size="sm"
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              Sync Products
            </Button>
            <Button
              onClick={handleSyncInventory}
              disabled={syncingInventory || connectedCount === 0}
              variant="outline"
              size="sm"
            >
              {syncingInventory ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Warehouse className="mr-2 h-4 w-4" />
              )}
              Sync Inventory
            </Button>
          </div>

          {/* Channel cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => {
              const meta = CHANNEL_META[channel.channel_type] || { icon: '⚪', color: '' };
              const statusInfo = syncStatus[channel.channel_type];
              return (
                <Card key={channel.channel_type}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{meta.icon}</span>
                        <CardTitle className="text-lg">{channel.display_name}</CardTitle>
                      </div>
                      {channel.connected ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="mr-1 h-3 w-3" /> Disconnected
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {channel.mode === 'demo'
                        ? 'Demo mode — no real API calls'
                        : 'Live connection'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {statusInfo && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Last checked: {new Date(statusInfo.checked_at).toLocaleString()}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {channel.connected ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleViewProducts(channel.channel_type)}
                          >
                            <Package className="mr-1 h-3 w-3" />
                            Products
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDisconnect(channel.channel_type)}
                          >
                            <Unplug className="mr-1 h-3 w-3" />
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSetupChannel(channel);
                            setSetupCreds({});
                          }}
                        >
                          <Plug className="mr-1 h-3 w-3" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Orders Tab ───────────────────────────────────────────── */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Unified Order Feed
              </CardTitle>
              <CardDescription>
                Orders from all connected marketplace channels in one view.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-500">
                  No orders found. Connect channels and sync to see orders here.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.external_id}>
                        <TableCell>{channelBadge(order.channel_type)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {order.external_order_number || order.external_id}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customer_name || '—'}</p>
                            <p className="text-xs text-neutral-500">{order.customer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          $
                          {order.total_amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === 'confirmed' || order.status === 'delivered'
                                ? 'default'
                                : order.status === 'cancelled'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-neutral-500">
                          {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Sync Status Tab ──────────────────────────────────────── */}
        <TabsContent value="sync" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(syncStatus).map(([chType, status]) => (
              <Card key={chType}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{status.display_name}</CardTitle>
                    {status.connected ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>
                    <span className="text-neutral-500">Status:</span>{' '}
                    {status.connected ? 'Healthy' : 'Disconnected'}
                  </p>
                  <p>
                    <span className="text-neutral-500">Message:</span> {status.message}
                  </p>
                  <p className="text-xs text-neutral-400">
                    Checked: {new Date(status.checked_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {Object.keys(syncStatus).length === 0 && (
            <p className="py-8 text-center text-sm text-neutral-500">
              No channels connected yet. Go to the Channels tab to connect.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Setup Wizard Dialog ─────────────────────────────────────── */}
      <Dialog open={!!setupChannel} onOpenChange={(open) => !open && setSetupChannel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to {setupChannel?.display_name}</DialogTitle>
            <DialogDescription>
              {setupChannel?.mode === 'demo'
                ? 'Demo mode: credentials are optional. Click Connect to use mock data.'
                : 'Enter your API credentials to connect this channel.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {setupChannel?.setup_fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="ml-1 text-red-500">*</span>}
                </Label>
                <Input
                  id={field.key}
                  type={field.type === 'password' ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={setupCreds[field.key] || ''}
                  onChange={(e) =>
                    setSetupCreds((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupChannel(null)}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plug className="mr-2 h-4 w-4" />
                  Connect
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Products Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!viewProducts} onOpenChange={(open) => !open && setViewProducts(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {viewProducts && (
                <span className="flex items-center gap-2">
                  {channelBadge(viewProducts)} Products
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {loadingProducts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.external_id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku || '—'}</TableCell>
                    <TableCell className="text-right">
                      ${p.price.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">{p.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-neutral-500">
                      No products listed on this channel.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
