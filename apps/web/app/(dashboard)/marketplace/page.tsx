/**
 * Marketplace Integration Management
 *
 * Multi-channel marketplace hub — Shopify, eBay, and Facebook Marketplace.
 * Manage connections, sync products/inventory, and view unified order feed.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Store,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShoppingBag,
  Package,
  ArrowUpDown,
  Plug,
  PlugZap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  marketplaceApi,
  type ChannelInfo,
  type MarketplaceOrder,
  type SyncStatusResponse,
} from '@/lib/api/marketplace';

const CHANNEL_ICONS: Record<string, string> = {
  shopify: '🛍️',
  ebay: '🔵',
  facebook: '📘',
};

const CHANNEL_COLORS: Record<string, string> = {
  shopify: 'text-green-600',
  ebay: 'text-blue-600',
  facebook: 'text-blue-800',
};

function StatusBadge({ status }: { status: ChannelInfo['status'] }) {
  const variants = {
    connected: 'default',
    disconnected: 'secondary',
    error: 'destructive',
    pending: 'outline',
  } as const;
  return <Badge variant={variants[status]}>{status}</Badge>;
}

export default function MarketplacePage() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<'products' | 'inventory' | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [channelsRes, statusRes, ordersRes] = await Promise.all([
        marketplaceApi.getChannels(),
        marketplaceApi.getSyncStatus(),
        marketplaceApi.getOrders(),
      ]);
      setChannels(channelsRes.channels);
      setSyncStatus(statusRes);
      setOrders(ordersRes.orders);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Load Failed',
        description: 'Could not load marketplace data.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async (channelType: string) => {
    setConnecting(channelType);
    try {
      const result = await marketplaceApi.connect(channelType, {});
      toast({
        title: result.success ? 'Connected' : 'Connection Failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      await loadData();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: err instanceof Error ? err.message : 'Failed to connect channel.',
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (channelType: string) => {
    setConnecting(channelType);
    try {
      await marketplaceApi.disconnect(channelType);
      toast({ title: 'Disconnected', description: `${channelType} channel disconnected.` });
      await loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to disconnect.' });
    } finally {
      setConnecting(null);
    }
  };

  const handleSyncProducts = async () => {
    setSyncing('products');
    try {
      const result = await marketplaceApi.syncProducts();
      const total = Object.values(result.results).reduce((sum, r) => sum + r.pushed, 0);
      toast({
        title: 'Product Sync Complete',
        description: `${total} products pushed to marketplace channels.`,
      });
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: err instanceof Error ? err.message : 'Product sync failed.',
      });
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncInventory = async () => {
    setSyncing('inventory');
    try {
      const result = await marketplaceApi.syncInventory();
      const total = Object.values(result.results).reduce((sum, r) => sum + r.synced, 0);
      toast({
        title: 'Inventory Sync Complete',
        description: `${total} items synced across channels.`,
      });
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: err instanceof Error ? err.message : 'Inventory sync failed.',
      });
    } finally {
      setSyncing(null);
    }
  };

  const connectedCount = channels.filter((c) => c.connected).length;
  const filteredOrders =
    orderFilter === 'all' ? orders : orders.filter((o) => o.channel_type === orderFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace Channels</h1>
          <p className="text-muted-foreground">
            Manage Shopify, eBay, and Facebook Marketplace from one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncInventory}
            disabled={syncing !== null || connectedCount === 0}
          >
            <ArrowUpDown
              className={`mr-2 h-4 w-4 ${syncing === 'inventory' ? 'animate-spin' : ''}`}
            />
            Sync Inventory
          </Button>
          <Button onClick={handleSyncProducts} disabled={syncing !== null || connectedCount === 0}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing === 'products' ? 'animate-spin' : ''}`} />
            Sync Products
          </Button>
        </div>
      </div>

      {/* Sync health banner */}
      {syncStatus && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            syncStatus.overall_healthy
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-orange-200 bg-orange-50 text-orange-800'
          }`}
        >
          {syncStatus.overall_healthy ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>
            {syncStatus.overall_healthy
              ? `All ${connectedCount} connected channels are healthy.`
              : 'One or more channels have connectivity issues.'}
          </span>
        </div>
      )}

      {/* Channel Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {channels.map((channel) => (
            <Card key={channel.channel_type}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{CHANNEL_ICONS[channel.channel_type] ?? '🏪'}</span>
                    <span className={CHANNEL_COLORS[channel.channel_type]}>
                      {channel.display_name}
                    </span>
                  </span>
                  <StatusBadge status={channel.status} />
                </CardTitle>
                <CardDescription className="capitalize">{channel.mode} mode</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-muted-foreground space-y-1 text-xs">
                  {channel.last_product_sync && (
                    <div>
                      Products synced: {new Date(channel.last_product_sync).toLocaleString('en-AU')}
                    </div>
                  )}
                  {channel.last_inventory_sync && (
                    <div>
                      Inventory synced:{' '}
                      {new Date(channel.last_inventory_sync).toLocaleString('en-AU')}
                    </div>
                  )}
                  {channel.last_order_sync && (
                    <div>
                      Orders synced: {new Date(channel.last_order_sync).toLocaleString('en-AU')}
                    </div>
                  )}
                  {!channel.last_product_sync &&
                    !channel.last_inventory_sync &&
                    !channel.last_order_sync && <div className="italic">Not yet synced</div>}
                </div>
                {channel.connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={connecting === channel.channel_type}
                    onClick={() => handleDisconnect(channel.channel_type)}
                  >
                    <XCircle className="mr-2 h-3.5 w-3.5" />
                    {connecting === channel.channel_type ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={connecting === channel.channel_type}
                    onClick={() => handleConnect(channel.channel_type)}
                  >
                    <PlugZap className="mr-2 h-3.5 w-3.5" />
                    {connecting === channel.channel_type ? 'Connecting…' : 'Connect (Demo)'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {channels.length === 0 && (
            <div className="col-span-3 py-12 text-center">
              <Store className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
              <p className="text-muted-foreground">No marketplace channels configured.</p>
            </div>
          )}
        </div>
      )}

      {/* Orders feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Unified Order Feed
              </CardTitle>
              <CardDescription>{orders.length} orders across all channels</CardDescription>
            </div>
            <Select value={orderFilter} onValueChange={setOrderFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {channels.map((c) => (
                  <SelectItem key={c.channel_type} value={c.channel_type}>
                    {c.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={`${order.channel_type}-${order.external_id}`}>
                    <TableCell className="font-mono text-sm">
                      {order.external_order_number || order.external_id}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <span>{CHANNEL_ICONS[order.channel_type] ?? '🏪'}</span>
                        <span className="capitalize">{order.channel_type}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customer_name || '—'}</div>
                      <div className="text-muted-foreground text-xs">
                        {order.customer_email || ''}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      ${order.total_amount.toFixed(2)} {order.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {order.ordered_at
                        ? new Date(order.ordered_at).toLocaleDateString('en-AU')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      <Package className="text-muted-foreground mx-auto mb-2 h-10 w-10" />
                      <p className="text-muted-foreground text-sm">
                        {orderFilter === 'all'
                          ? 'No marketplace orders yet. Connect channels and sync to see orders here.'
                          : `No orders from ${orderFilter}.`}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Setup guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Plug className="text-muted-foreground h-4 w-4" />
            Live Connection Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          <p>
            Channels currently run in <strong>demo mode</strong>. To connect live:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Shopify</strong>: Add <code>SHOPIFY_STORE_DOMAIN</code> and{' '}
              <code>SHOPIFY_ACCESS_TOKEN</code> to your environment variables.
            </li>
            <li>
              <strong>eBay</strong>: Add <code>EBAY_APP_ID</code>, <code>EBAY_CERT_ID</code>, and{' '}
              <code>EBAY_AUTH_TOKEN</code>.
            </li>
            <li>
              <strong>Facebook</strong>: Add <code>FB_PAGE_ACCESS_TOKEN</code> and{' '}
              <code>FB_CATALOG_ID</code>.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
