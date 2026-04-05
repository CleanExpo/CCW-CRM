/**
 * Marketplace Integration Management — Phase A5
 * UNI-1583: Unified Multi-Channel Dashboard
 *
 * Tabs: Overview (channels + health) | Products (cross-channel view,
 * discrepancy alerts, bulk list/unlist) | Orders (unified feed)
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
  LayoutGrid,
  ListChecks,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  type UnifiedProduct,
  type BulkUnlistItem,
} from '@/lib/api/marketplace';

// ─── Channel metadata ────────────────────────────────────────────────

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

// ─── Sub-components ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChannelInfo['status'] }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    connected: 'default',
    disconnected: 'secondary',
    error: 'destructive',
    pending: 'outline',
  };
  return <Badge variant={variants[status] ?? 'secondary'}>{status}</Badge>;
}

function DiscrepancyBadge({ product }: { product: UnifiedProduct }) {
  if (!product.has_discrepancy) return null;
  return (
    <Badge variant="outline" className="border-orange-400 text-orange-600 gap-1">
      <AlertTriangle className="h-3 w-3" />
      Stock mismatch ({product.min_stock}–{product.max_stock})
    </Badge>
  );
}

function ChannelStockCell({
  data,
  channelType,
}: {
  data: UnifiedProduct['channels'][string] | undefined;
  channelType: string;
}) {
  if (!data) {
    return <span className="text-muted-foreground text-xs">Not listed</span>;
  }
  return (
    <div className="space-y-0.5">
      <div className="text-sm font-medium">{data.quantity} in stock</div>
      <div className="text-muted-foreground text-xs">${data.price.toFixed(2)} AUD</div>
      <Badge
        variant={data.status === 'active' ? 'default' : 'secondary'}
        className="text-[10px] h-4"
      >
        {data.status}
      </Badge>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { toast } = useToast();

  // Shared state
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<'products' | 'inventory' | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  // Orders tab state
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');

  // Products tab state
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [productChannels, setProductChannels] = useState<string[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkUnlisting, setBulkUnlisting] = useState(false);

  // ── Data loaders ───────────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [channelsRes, statusRes] = await Promise.all([
        marketplaceApi.getChannels(),
        marketplaceApi.getSyncStatus(),
      ]);
      setChannels(channelsRes.channels);
      setSyncStatus(statusRes);
    } catch {
      toast({ variant: 'destructive', title: 'Load Failed', description: 'Could not load channel data.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await marketplaceApi.getOrders();
      setOrders(res.orders);
    } catch {
      toast({ variant: 'destructive', title: 'Load Failed', description: 'Could not load orders.' });
    } finally {
      setOrdersLoading(false);
    }
  }, [toast]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setSelectedProducts(new Set());
    try {
      const res = await marketplaceApi.getUnifiedProducts(100);
      setProducts(res.products);
      setProductChannels(res.channels);
    } catch {
      toast({ variant: 'destructive', title: 'Load Failed', description: 'Could not load products.' });
    } finally {
      setProductsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // ── Actions ────────────────────────────────────────────────────────

  const handleConnect = async (channelType: string) => {
    setConnecting(channelType);
    try {
      const result = await marketplaceApi.connect(channelType, {});
      toast({
        title: result.success ? 'Connected' : 'Connection Failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
      await loadOverview();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: err instanceof Error ? err.message : 'Failed to connect.',
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (channelType: string) => {
    setConnecting(channelType);
    try {
      await marketplaceApi.disconnect(channelType);
      toast({ title: 'Disconnected', description: `${channelType} disconnected.` });
      await loadOverview();
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
      toast({ title: 'Sync Complete', description: `${total} products pushed to channels.` });
      await loadProducts();
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Sync Failed', description: err instanceof Error ? err.message : 'Product sync failed.' });
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncInventory = async () => {
    setSyncing('inventory');
    try {
      const result = await marketplaceApi.syncInventory();
      const total = Object.values(result.results).reduce((sum, r) => sum + r.synced, 0);
      toast({ title: 'Inventory Synced', description: `${total} items synced across channels.` });
      await loadProducts();
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Sync Failed', description: err instanceof Error ? err.message : 'Inventory sync failed.' });
    } finally {
      setSyncing(null);
    }
  };

  const handleBulkUnlist = async (channelType: string) => {
    if (selectedProducts.size === 0) return;
    setBulkUnlisting(true);
    try {
      const items: BulkUnlistItem[] = [];
      for (const sku of selectedProducts) {
        const product = products.find((p) => (p.sku ?? p.title) === sku);
        if (product && product.channels[channelType]) {
          items.push({ external_id: product.channels[channelType].external_id, channel_type: channelType });
        }
      }
      if (items.length === 0) {
        toast({ title: 'Nothing to unlist', description: `Selected products are not listed on ${channelType}.` });
        return;
      }
      const result = await marketplaceApi.bulkUnlistProducts(items);
      toast({
        title: 'Bulk Unlist Complete',
        description: `${result.success_count} removed from ${channelType}${result.failed_count > 0 ? `, ${result.failed_count} failed` : ''}.`,
        variant: result.failed_count > 0 ? 'destructive' : 'default',
      });
      setSelectedProducts(new Set());
      await loadProducts();
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Unlist Failed', description: err instanceof Error ? err.message : 'Bulk unlist failed.' });
    } finally {
      setBulkUnlisting(false);
    }
  };

  // ── Selection helpers ──────────────────────────────────────────────

  const toggleProduct = (key: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map((p) => p.sku ?? p.title)));
    }
  };

  // ── Derived state ──────────────────────────────────────────────────

  const connectedCount = channels.filter((c) => c.connected).length;
  const filteredOrders = orderFilter === 'all' ? orders : orders.filter((o) => o.channel_type === orderFilter);
  const discrepancyCount = products.filter((p) => p.has_discrepancy).length;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace Channels</h1>
          <p className="text-muted-foreground">
            Unified multi-channel hub — Shopify, eBay &amp; Facebook Marketplace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncInventory}
            disabled={syncing !== null || connectedCount === 0}
          >
            <ArrowUpDown className={`mr-2 h-4 w-4 ${syncing === 'inventory' ? 'animate-spin' : ''}`} />
            Sync Inventory
          </Button>
          <Button onClick={handleSyncProducts} disabled={syncing !== null || connectedCount === 0}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing === 'products' ? 'animate-spin' : ''}`} />
            Sync Products
          </Button>
        </div>
      </div>

      {/* Health banner */}
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
          {discrepancyCount > 0 && (
            <span className="ml-auto flex items-center gap-1 font-medium text-orange-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {discrepancyCount} inventory discrepanc{discrepancyCount === 1 ? 'y' : 'ies'} detected
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" onValueChange={(v) => {
        if (v === 'orders' && orders.length === 0) loadOrders();
        if (v === 'products' && products.length === 0) loadProducts();
      }}>
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="mr-2 h-4 w-4" />
            Products
            {discrepancyCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-4 min-w-4 px-1 text-[10px]">
                {discrepancyCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Orders
          </TabsTrigger>
        </TabsList>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
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
                        <div>Products: {new Date(channel.last_product_sync).toLocaleString('en-AU')}</div>
                      )}
                      {channel.last_inventory_sync && (
                        <div>Inventory: {new Date(channel.last_inventory_sync).toLocaleString('en-AU')}</div>
                      )}
                      {channel.last_order_sync && (
                        <div>Orders: {new Date(channel.last_order_sync).toLocaleString('en-AU')}</div>
                      )}
                      {!channel.last_product_sync && !channel.last_inventory_sync && !channel.last_order_sync && (
                        <div className="italic">Not yet synced</div>
                      )}
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

          {/* Setup guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Plug className="text-muted-foreground h-4 w-4" />
                Live Connection Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              <p>Channels currently run in <strong>demo mode</strong>. To connect live:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>Shopify</strong>: Add <code>SHOPIFY_STORE_DOMAIN</code> and <code>SHOPIFY_ACCESS_TOKEN</code>.</li>
                <li><strong>eBay</strong>: Add <code>EBAY_APP_ID</code>, <code>EBAY_CERT_ID</code>, and <code>EBAY_AUTH_TOKEN</code>.</li>
                <li><strong>Facebook</strong>: Add <code>FB_PAGE_ACCESS_TOKEN</code> and <code>FB_CATALOG_ID</code>.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Products tab ── */}
        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5" />
                    Unified Product Catalogue
                  </CardTitle>
                  <CardDescription>
                    {products.length} products across {productChannels.length} channels
                    {discrepancyCount > 0 && (
                      <span className="ml-2 font-medium text-orange-600">
                        · {discrepancyCount} stock discrepanc{discrepancyCount === 1 ? 'y' : 'ies'}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedProducts.size > 0 && (
                    <>
                      <span className="text-muted-foreground text-sm">
                        {selectedProducts.size} selected
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={bulkUnlisting}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            {bulkUnlisting ? 'Unlisting…' : 'Bulk Unlist'}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Remove from channel</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {productChannels.map((ch) => (
                            <DropdownMenuItem
                              key={ch}
                              onClick={() => handleBulkUnlist(ch)}
                            >
                              <span className="mr-2">{CHANNEL_ICONS[ch] ?? '🏪'}</span>
                              Unlist from {ch.charAt(0).toUpperCase() + ch.slice(1)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={loadProducts} disabled={productsLoading}>
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${productsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={products.length > 0 && selectedProducts.size === products.length}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Product</TableHead>
                      {productChannels.map((ch) => (
                        <TableHead key={ch}>
                          <span className="flex items-center gap-1">
                            <span>{CHANNEL_ICONS[ch] ?? '🏪'}</span>
                            <span className="capitalize">{ch}</span>
                          </span>
                        </TableHead>
                      ))}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const key = product.sku ?? product.title;
                      const isSelected = selectedProducts.has(key);
                      return (
                        <TableRow
                          key={key}
                          className={isSelected ? 'bg-muted/40' : undefined}
                          data-state={isSelected ? 'selected' : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleProduct(key)}
                              aria-label={`Select ${product.title}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{product.title}</div>
                            {product.sku && (
                              <div className="text-muted-foreground font-mono text-xs">{product.sku}</div>
                            )}
                          </TableCell>
                          {productChannels.map((ch) => (
                            <TableCell key={ch}>
                              <ChannelStockCell
                                data={product.channels[ch]}
                                channelType={ch}
                              />
                            </TableCell>
                          ))}
                          <TableCell>
                            <DiscrepancyBadge product={product} />
                            {!product.has_discrepancy && (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                In sync
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {products.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={productChannels.length + 3} className="py-10 text-center">
                          <Package className="text-muted-foreground mx-auto mb-2 h-10 w-10" />
                          <p className="text-muted-foreground text-sm">
                            No products found. Connect channels and sync to see listings here.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={handleSyncProducts}
                            disabled={syncing !== null || connectedCount === 0}
                          >
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            Sync Products Now
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Orders tab ── */}
        <TabsContent value="orders" className="mt-4">
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
                <div className="flex items-center gap-2">
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
                  <Button variant="outline" size="sm" onClick={loadOrders} disabled={ordersLoading}>
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
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
                          <div className="text-muted-foreground text-xs">{order.customer_email || ''}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          ${order.total_amount.toFixed(2)} {order.currency}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString('en-AU') : '—'}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
