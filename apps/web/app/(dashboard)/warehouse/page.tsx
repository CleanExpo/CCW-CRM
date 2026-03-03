'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  ArrowRightLeft,
  ClipboardCheck,
  Clock,
  MapPin,
  Package,
  RefreshCw,
  Sparkles,
  Truck,
} from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { useToast } from '@/hooks/use-toast';
import { StoreLocation } from '@/lib/types/inventory';
import type { CreateStockTransferRequest } from '@/lib/types/inventory';

interface LocationStockItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  stock: number;
  reserved: number;
  available: number;
  reorder_point: number | null;
  below_reorder_point: boolean;
}

interface LocationStockResponse {
  location: string;
  items: LocationStockItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

type ReceivingShipment = {
  id: string;
  supplier: string;
  container: string;
  eta: string;
  dock: string;
  items: number;
  status: string;
  priority: string;
};

type PickOrder = {
  id: string;
  customer: string;
  zone: string;
  lines: number;
  promised: string;
  status: string;
  priority: string;
};

type ReturnCase = {
  id: string;
  customer: string;
  reason: string;
  items: number;
  sla: string;
  status: string;
};

type Guidance = {
  title: string;
  detail: string;
  impact: string;
};

type WarehouseOpsPayload = {
  updatedAt: string;
  metrics: {
    inboundToday: number;
    inboundDocked: number;
    inboundScheduled: number;
    picksDueToday: number;
    rushPicks: number;
    returnsOpen: number;
    returnSlaRisk: number;
    onTimeRate: number;
  };
  receivingQueue: ReceivingShipment[];
  pickQueue: PickOrder[];
  returnsQueue: ReturnCase[];
  aiGuidance: Guidance[];
};

const LOCATIONS = ['brisbane', 'sydney', 'melbourne'] as const;
type Location = (typeof LOCATIONS)[number];

const priorityBadge = (priority: string) => {
  switch (priority) {
    case 'rush':
    case 'high':
      return 'destructive';
    case 'normal':
      return 'secondary';
    default:
      return 'outline';
  }
};

const statusBadge = (status: string) => {
  if (status === 'in_progress' || status === 'picking') return 'processing' as const;
  if (status === 'inspection') return 'pending' as const;
  return 'outline' as const;
};

export default function WarehouseOpsPage() {
  const { toast } = useToast();

  // Operations tab state
  const [data, setData] = useState<WarehouseOpsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Locations tab state
  const [selectedLocation, setSelectedLocation] = useState<Location>('brisbane');
  const [locationStock, setLocationStock] = useState<LocationStockResponse | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  // Transfer tab state
  const [transfer, setTransfer] = useState<CreateStockTransferRequest>({
    product_id: '',
    from_location: StoreLocation.BRISBANE,
    to_location: StoreLocation.SYDNEY,
    quantity: 1,
    reason: '',
  });
  const [isTransferring, setIsTransferring] = useState(false);

  // ── Operations ──────────────────────────────────────────────────────────────

  const loadOps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/warehouse/ops', { cache: 'no-store' });
      if (!response.ok) throw new Error('Warehouse ops feed is unavailable.');
      const payload = (await response.json()) as WarehouseOpsPayload;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load warehouse ops.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOps();
  }, [loadOps]);

  const metrics = data?.metrics;
  const receivingQueue = data?.receivingQueue ?? [];
  const pickQueue = data?.pickQueue ?? [];
  const returnsQueue = data?.returnsQueue ?? [];
  const aiGuidance = data?.aiGuidance ?? [];
  const lastUpdated = useMemo(() => {
    if (!data?.updatedAt) return null;
    return new Date(data.updatedAt).toLocaleTimeString();
  }, [data?.updatedAt]);

  // ── Locations ───────────────────────────────────────────────────────────────

  const loadLocationStock = useCallback(
    async (loc: Location) => {
      setIsLoadingStock(true);
      try {
        const result = await inventoryApi.getStockByLocation(loc, { page: 1, page_size: 50 });
        setLocationStock(result as unknown as LocationStockResponse);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load stock for location',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingStock(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadLocationStock(selectedLocation);
  }, [selectedLocation, loadLocationStock]);

  // ── Transfers ───────────────────────────────────────────────────────────────

  const handleTransfer = async () => {
    if (!transfer.product_id.trim()) {
      toast({ title: 'Error', description: 'Product ID is required', variant: 'destructive' });
      return;
    }
    if (transfer.from_location === transfer.to_location) {
      toast({
        title: 'Error',
        description: 'Source and destination must differ',
        variant: 'destructive',
      });
      return;
    }
    setIsTransferring(true);
    try {
      await inventoryApi.createTransfer(transfer);
      toast({
        title: 'Transfer created',
        description: `Stock transfer from ${transfer.from_location} to ${transfer.to_location} queued.`,
      });
      setTransfer({
        product_id: '',
        from_location: StoreLocation.BRISBANE,
        to_location: StoreLocation.SYDNEY,
        quantity: 1,
        reason: '',
      });
    } catch (err) {
      toast({
        title: 'Transfer failed',
        description: err instanceof Error ? err.message : 'Could not create transfer',
        variant: 'destructive',
      });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Warehouse Operations</h1>
          <p className="text-muted-foreground">
            Receiving, pick/pack, returns, location stock, and inter-location transfers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadOps} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/inventory">Open inventory</Link>
          </Button>
          <Button asChild>
            <Link href="/containers">Start receiving</Link>
          </Button>
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <span>{lastUpdated ? `Updated ${lastUpdated}` : 'Loading latest signal...'}</span>
        {error ? <Badge variant="destructive">{error}</Badge> : null}
      </div>

      {/* Header metric cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbound today</CardTitle>
            <Truck className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.inboundToday ?? 0}</div>
            <p className="text-muted-foreground text-xs">
              {metrics?.inboundDocked ?? 0} docked, {metrics?.inboundScheduled ?? 0} scheduled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Picks due today</CardTitle>
            <ClipboardCheck className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.picksDueToday ?? 0}</div>
            <p className="text-muted-foreground text-xs">{metrics?.rushPicks ?? 0} rush orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Returns & service</CardTitle>
            <RefreshCw className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.returnsOpen ?? 0}</div>
            <p className="text-muted-foreground text-xs">{metrics?.returnSlaRisk ?? 0} SLA risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-time rate</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.onTimeRate ?? 0}%</div>
            <p className="text-muted-foreground text-xs">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="operations">
        <TabsList>
          <TabsTrigger value="operations">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="locations">
            <MapPin className="mr-2 h-4 w-4" />
            Locations &amp; Stock
          </TabsTrigger>
          <TabsTrigger value="transfers">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfers
          </TabsTrigger>
        </TabsList>

        {/* ── Operations Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="operations" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Receiving queue</CardTitle>
                      <CardDescription>Inbound shipments scheduled for dock.</CardDescription>
                    </div>
                    <Badge variant="outline">{receivingQueue.length} shipments</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {receivingQueue.map((shipment) => (
                    <div
                      key={shipment.id}
                      className="border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{shipment.id}</p>
                        <p className="text-muted-foreground text-xs">{shipment.supplier}</p>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                          <span>{shipment.container}</span>
                          <span>{shipment.items} items</span>
                          <span>{shipment.dock}</span>
                        </div>
                      </div>
                      <div className="text-muted-foreground text-right text-xs">
                        <p className="text-foreground font-semibold">{shipment.eta}</p>
                        <div className="mt-1 flex items-center justify-end gap-2">
                          <Badge variant={statusBadge(shipment.status)}>
                            {shipment.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant={priorityBadge(shipment.priority)}>
                            {shipment.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/containers">View inbound plan</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Pick &amp; pack queue</CardTitle>
                      <CardDescription>Orders staged for picking and packing.</CardDescription>
                    </div>
                    <Badge variant="outline">{pickQueue.length} picks</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pickQueue.map((pick) => (
                    <div
                      key={pick.id}
                      className="border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{pick.id}</p>
                        <p className="text-muted-foreground text-xs">{pick.customer}</p>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                          <span>{pick.zone}</span>
                          <span>{pick.lines} lines</span>
                          <span>Promised {pick.promised}</span>
                        </div>
                      </div>
                      <div className="text-muted-foreground text-right text-xs">
                        <p className="text-foreground font-semibold">{pick.status}</p>
                        <div className="mt-1 flex items-center justify-end gap-2">
                          <Badge variant={statusBadge(pick.status)}>{pick.status}</Badge>
                          <Badge variant={priorityBadge(pick.priority)}>{pick.priority}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm">
                    Assign pickers
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Returns &amp; service</CardTitle>
                      <CardDescription>Warehouse CRM follow-ups and SLAs.</CardDescription>
                    </div>
                    <Badge variant="outline">{returnsQueue.length} cases</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {returnsQueue.map((rma) => (
                    <div
                      key={rma.id}
                      className="border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{rma.id}</p>
                        <p className="text-muted-foreground text-xs">{rma.customer}</p>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                          <span>{rma.reason}</span>
                          <span>{rma.items} items</span>
                        </div>
                      </div>
                      <div className="text-muted-foreground text-right text-xs">
                        <p className="text-foreground font-semibold">{rma.sla}</p>
                        <div className="mt-1 flex items-center justify-end gap-2">
                          <Badge variant={statusBadge(rma.status)}>
                            {rma.status.replace('_', ' ')}
                          </Badge>
                          {rma.sla.includes('4h') ? (
                            <Badge variant="destructive">at risk</Badge>
                          ) : (
                            <Badge variant="outline">within SLA</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm">
                    Open service queue
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6 lg:col-span-5">
              <Card className="bg-primary text-primary-foreground">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <CardTitle className="text-primary-foreground">AI warehouse guidance</CardTitle>
                  </div>
                  <CardDescription className="text-primary-foreground/70">
                    Priority insights for shift leads and warehouse CRM.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {aiGuidance.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-white/15 bg-white/10 p-4"
                    >
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-primary-foreground/70 text-xs">{item.detail}</p>
                      <p className="text-primary-foreground mt-2 text-xs font-semibold">
                        {item.impact}
                      </p>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm">
                    Launch AI runbook
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-warning h-4 w-4" />
                    <CardTitle>Operational risks</CardTitle>
                  </div>
                  <CardDescription>Issues that need immediate attention.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="border-border/60 bg-muted/20 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">Backorder exposure</p>
                        <p className="text-muted-foreground text-xs">
                          3 SKUs are below reorder point with open quotes.
                        </p>
                      </div>
                      <Badge variant="destructive">High</Badge>
                    </div>
                  </div>
                  <div className="border-border/60 bg-muted/20 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">Pending quality checks</p>
                        <p className="text-muted-foreground text-xs">
                          2 inbound pallets are waiting on QA sign-off.
                        </p>
                      </div>
                      <Badge variant="secondary">Medium</Badge>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Next review</span>
                    <span className="text-xs font-semibold">Today 3:30 PM</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Package className="text-muted-foreground h-4 w-4" />
                    <CardTitle>Labor plan</CardTitle>
                  </div>
                  <CardDescription>Shift staffing aligned to workload.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Receiving crew</span>
                    <span className="font-semibold">6 assigned</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pick/pack crew</span>
                    <span className="font-semibold">12 assigned</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Returns QA</span>
                    <span className="font-semibold">3 assigned</span>
                  </div>
                  <Button variant="outline" size="sm">
                    Adjust roster
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Locations & Stock Tab ───────────────────────────────────────────── */}
        <TabsContent value="locations" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Stock by Location</CardTitle>
                  <CardDescription>
                    Current stock levels at each warehouse location.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {LOCATIONS.map((loc) => (
                    <Button
                      key={loc}
                      size="sm"
                      variant={selectedLocation === loc ? 'default' : 'outline'}
                      onClick={() => setSelectedLocation(loc)}
                      className="capitalize"
                    >
                      {loc}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingStock ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Loading stock levels…
                </p>
              ) : !locationStock || locationStock.items.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No stock records found for {selectedLocation}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">SKU</th>
                        <th className="py-2 text-left font-medium">Product</th>
                        <th className="py-2 text-right font-medium">Stock</th>
                        <th className="py-2 text-right font-medium">Reserved</th>
                        <th className="py-2 text-right font-medium">Available</th>
                        <th className="py-2 text-right font-medium">Reorder Pt</th>
                        <th className="py-2 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {locationStock.items.map((item) => (
                        <tr key={item.product_id} className="hover:bg-muted/40">
                          <td className="text-muted-foreground py-2 font-mono text-xs">
                            {item.product_sku}
                          </td>
                          <td className="py-2">{item.product_name}</td>
                          <td className="py-2 text-right font-semibold">{item.stock}</td>
                          <td className="text-muted-foreground py-2 text-right">{item.reserved}</td>
                          <td className="py-2 text-right">{item.available}</td>
                          <td className="text-muted-foreground py-2 text-right">
                            {item.reorder_point ?? '—'}
                          </td>
                          <td className="py-2 text-center">
                            {item.below_reorder_point ? (
                              <Badge variant="destructive" className="text-xs">
                                Low
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                OK
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-muted-foreground mt-4 text-xs">
                    Showing {locationStock.items.length} of {locationStock.total} products at{' '}
                    <span className="capitalize">{selectedLocation}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Transfers Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="transfers" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Initiate Stock Transfer</CardTitle>
                <CardDescription>
                  Move stock between Brisbane, Sydney, and Melbourne.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product-id">Product ID</Label>
                  <Input
                    id="product-id"
                    placeholder="UUID of the product"
                    value={transfer.product_id}
                    onChange={(e) => setTransfer((t) => ({ ...t, product_id: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from-location">From</Label>
                    <select
                      id="from-location"
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      value={transfer.from_location}
                      onChange={(e) =>
                        setTransfer((t) => ({
                          ...t,
                          from_location: e.target.value as StoreLocation,
                        }))
                      }
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l} className="capitalize">
                          {l.charAt(0).toUpperCase() + l.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to-location">To</Label>
                    <select
                      id="to-location"
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      value={transfer.to_location}
                      onChange={(e) =>
                        setTransfer((t) => ({ ...t, to_location: e.target.value as StoreLocation }))
                      }
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l} className="capitalize">
                          {l.charAt(0).toUpperCase() + l.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={transfer.quantity}
                    onChange={(e) =>
                      setTransfer((t) => ({ ...t, quantity: parseInt(e.target.value, 10) || 1 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input
                    id="reason"
                    placeholder="e.g. Rebalance stock after high demand"
                    value={transfer.reason ?? ''}
                    onChange={(e) => setTransfer((t) => ({ ...t, reason: e.target.value }))}
                  />
                </div>
                <Button onClick={handleTransfer} disabled={isTransferring} className="w-full">
                  {isTransferring ? 'Creating transfer…' : 'Create Transfer'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transfer Guide</CardTitle>
                <CardDescription>How inter-location transfers work.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-4">
                  <p className="font-semibold">1. Enter product ID</p>
                  <p className="text-muted-foreground text-xs">
                    Copy from the Inventory or Products page. Each transfer moves a single SKU.
                  </p>
                </div>
                <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-4">
                  <p className="font-semibold">2. Set source and destination</p>
                  <p className="text-muted-foreground text-xs">
                    Stock is decremented from the source and incremented at the destination on
                    confirmation.
                  </p>
                </div>
                <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-4">
                  <p className="font-semibold">3. Review &amp; confirm</p>
                  <p className="text-muted-foreground text-xs">
                    Transfers are queued and visible in Inventory → Transfers. Stock updates after
                    manager approval.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/inventory">View transfer history</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
