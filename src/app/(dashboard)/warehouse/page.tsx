'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  ClipboardList,
  Clock,
  FileEdit,
  MapPin,
  Package,
  RefreshCw,
  Sparkles,
  Truck,
} from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { warehouseApi } from '@/lib/api/warehouse';
import {
  cin7InventoryWritebackApi,
  type StockAdjustmentRecord,
  type StockTransferRecord,
} from '@/lib/api/cin7-inventory-writeback';
import { useToast } from '@/hooks/use-toast';
import {
  StoreLocation,
  type CreateStockTransferRequest,
  type LocationStockItem,
  type LocationStockResponse,
  type WarehouseOpsPayload,
} from '@/types/inventory';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

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

  // ── Stock Take tab state ──────────────────────────────────────────────────
  const [stockTakeLocation, setStockTakeLocation] = useState<Location>('brisbane');
  const [activeStockTake, setActiveStockTake] = useState<{
    id: string;
    location: string;
    status: string;
    created_at: string;
  } | null>(null);
  const [stockTakeInventory, setStockTakeInventory] = useState<LocationStockItem[]>([]);
  const [stockTakeCounts, setStockTakeCounts] = useState<Record<string, number>>({});
  const [isStartingTake, setIsStartingTake] = useState(false);
  const [isSubmittingTake, setIsSubmittingTake] = useState(false);
  const [recentStockTakes, setRecentStockTakes] = useState<
    Array<{
      id: string;
      location: string;
      status: string;
      created_at: string;
      submitted_at: string | null;
    }>
  >([]);
  const [isLoadingTakes, setIsLoadingTakes] = useState(false);

  // Write-Back tab state (UNI-1265)
  const DEMO_LOCATIONS = [
    'Brisbane Warehouse',
    'Sydney Distribution',
    'Melbourne Depot',
    'Returns Bay',
  ] as const;
  const [adjForm, setAdjForm] = useState({
    location_id: 'Brisbane Warehouse',
    product_id: '',
    sku: '',
    adjustment_qty: 0,
    reason: '',
  });
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [wbTransferForm, setWbTransferForm] = useState({
    from_location_id: 'Brisbane Warehouse',
    to_location_id: 'Sydney Distribution',
    product_id: '',
    sku: '',
    quantity: 1,
    reference: '',
  });
  const [isWbTransferring, setIsWbTransferring] = useState(false);
  const [wbTransferConfirmOpen, setWbTransferConfirmOpen] = useState(false);
  const [recentAdjustments, setRecentAdjustments] = useState<StockAdjustmentRecord[]>([]);
  const [recentWbTransfers, setRecentWbTransfers] = useState<StockTransferRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // ── Operations ──────────────────────────────────────────────────────────────

  const loadOps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = (await warehouseApi.getOps()) as WarehouseOpsPayload;
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

  // ── Write-Back (UNI-1265) ────────────────────────────────────────────────────

  const loadWriteBackHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const [adjRes, tfrRes] = await Promise.all([
        cin7InventoryWritebackApi.listStockAdjustments(10),
        cin7InventoryWritebackApi.listStockTransfers(10),
      ]);
      setRecentAdjustments(adjRes.items);
      setRecentWbTransfers(tfrRes.items);
    } catch {
      // Silently fail — demo mode may not have the backend running
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const handleAdjustment = async () => {
    if (!adjForm.sku.trim()) {
      toast({ title: 'Error', description: 'SKU is required', variant: 'destructive' });
      return;
    }
    if (adjForm.adjustment_qty === 0) {
      toast({
        title: 'Error',
        description: 'Adjustment quantity cannot be zero',
        variant: 'destructive',
      });
      return;
    }
    setIsAdjusting(true);
    try {
      await cin7InventoryWritebackApi.createStockAdjustment({
        location_id: adjForm.location_id,
        product_id: adjForm.product_id || adjForm.sku,
        sku: adjForm.sku,
        adjustment_qty: adjForm.adjustment_qty,
        reason: adjForm.reason || null,
      });
      toast({
        title: 'Adjustment synced',
        description: `${adjForm.adjustment_qty > 0 ? '+' : ''}${adjForm.adjustment_qty} units for ${adjForm.sku}`,
      });
      setAdjForm({
        location_id: 'Brisbane Warehouse',
        product_id: '',
        sku: '',
        adjustment_qty: 0,
        reason: '',
      });
      void loadWriteBackHistory();
    } catch (err) {
      toast({
        title: 'Adjustment failed',
        description: err instanceof Error ? err.message : 'Could not sync adjustment',
        variant: 'destructive',
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleWbTransfer = async () => {
    if (!wbTransferForm.sku.trim()) {
      toast({ title: 'Error', description: 'SKU is required', variant: 'destructive' });
      return;
    }
    if (wbTransferForm.from_location_id === wbTransferForm.to_location_id) {
      toast({
        title: 'Error',
        description: 'Source and destination must differ',
        variant: 'destructive',
      });
      return;
    }
    setIsWbTransferring(true);
    try {
      await cin7InventoryWritebackApi.createStockTransfer({
        from_location_id: wbTransferForm.from_location_id,
        to_location_id: wbTransferForm.to_location_id,
        product_id: wbTransferForm.product_id || wbTransferForm.sku,
        sku: wbTransferForm.sku,
        quantity: wbTransferForm.quantity,
        reference: wbTransferForm.reference || null,
      });
      toast({
        title: 'Transfer synced',
        description: `${wbTransferForm.quantity} units of ${wbTransferForm.sku} transferred`,
      });
      setWbTransferForm({
        from_location_id: 'Brisbane Warehouse',
        to_location_id: 'Sydney Distribution',
        product_id: '',
        sku: '',
        quantity: 1,
        reference: '',
      });
      void loadWriteBackHistory();
    } catch (err) {
      toast({
        title: 'Transfer failed',
        description: err instanceof Error ? err.message : 'Could not sync transfer',
        variant: 'destructive',
      });
    } finally {
      setIsWbTransferring(false);
    }
  };

  // ── Stock Take handlers ───────────────────────────────────────────────────

  const loadStockTakes = useCallback(async () => {
    setIsLoadingTakes(true);
    try {
      const takes = await inventoryApi.getStockTakes();
      setRecentStockTakes(takes);
    } catch {
      // silently fail — backend may not be running
    } finally {
      setIsLoadingTakes(false);
    }
  }, []);

  const handleStartStockTake = async () => {
    setIsStartingTake(true);
    try {
      const take = await inventoryApi.startStockTake(stockTakeLocation);
      setActiveStockTake(take);
      const inv = await inventoryApi.getStockByLocation(stockTakeLocation, {
        page: 1,
        page_size: 100,
      });
      const items = (inv as unknown as LocationStockResponse).items;
      setStockTakeInventory(items);
      const initial: Record<string, number> = {};
      items.forEach((item) => {
        initial[item.product_id] = 0;
      });
      setStockTakeCounts(initial);
      toast({
        title: 'Stock take started',
        description: `Session created for ${stockTakeLocation}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to start',
        variant: 'destructive',
      });
    } finally {
      setIsStartingTake(false);
    }
  };

  const handleSubmitStockTake = async () => {
    if (!activeStockTake) return;
    setIsSubmittingTake(true);
    try {
      const items = Object.entries(stockTakeCounts).map(([product_id, counted_qty]) => ({
        product_id,
        counted_qty,
      }));
      const result = await inventoryApi.submitStockTake(activeStockTake.id, items);
      toast({
        title: 'Stock take submitted',
        description: `${result.items_processed} items processed`,
      });
      setActiveStockTake(null);
      setStockTakeInventory([]);
      setStockTakeCounts({});
      void loadStockTakes();
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Could not submit',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingTake(false);
    }
  };

  return (
    <ErrorBoundary>
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
              <p className="text-muted-foreground text-xs">
                {metrics?.returnSlaRisk ?? 0} SLA risk
              </p>
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
            <TabsTrigger value="writeback" onClick={() => void loadWriteBackHistory()}>
              <FileEdit className="mr-2 h-4 w-4" />
              Write-Back
            </TabsTrigger>
            <TabsTrigger value="stock-take" onClick={() => void loadStockTakes()}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Stock Take
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
                      <CardTitle className="text-primary-foreground">
                        AI warehouse guidance
                      </CardTitle>
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
                            <td className="text-muted-foreground py-2 text-right">
                              {item.reserved}
                            </td>
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
                          setTransfer((t) => ({
                            ...t,
                            to_location: e.target.value as StoreLocation,
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

          {/* ── Write-Back Tab (UNI-1265) ─────────────────────────────────────── */}
          <TabsContent value="writeback" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Stock Adjustment card */}
              <Card>
                <CardHeader>
                  <CardTitle>Stock Adjustment</CardTitle>
                  <CardDescription>
                    Add or remove stock at a location and sync to Cin7.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adj-location">Location</Label>
                    <select
                      id="adj-location"
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      value={adjForm.location_id}
                      onChange={(e) => setAdjForm((f) => ({ ...f, location_id: e.target.value }))}
                    >
                      {DEMO_LOCATIONS.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adj-sku">SKU</Label>
                    <Input
                      id="adj-sku"
                      placeholder="e.g. TM-2000"
                      value={adjForm.sku}
                      onChange={(e) => setAdjForm((f) => ({ ...f, sku: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adj-product-id">Product ID (optional)</Label>
                    <Input
                      id="adj-product-id"
                      placeholder="UUID or leave blank"
                      value={adjForm.product_id}
                      onChange={(e) => setAdjForm((f) => ({ ...f, product_id: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adj-qty">Quantity (+/-)</Label>
                    <Input
                      id="adj-qty"
                      type="number"
                      value={adjForm.adjustment_qty}
                      onChange={(e) =>
                        setAdjForm((f) => ({
                          ...f,
                          adjustment_qty: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                    />
                    <p className="text-muted-foreground text-xs">
                      Positive = add, negative = remove
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adj-reason">Reason (optional)</Label>
                    <Input
                      id="adj-reason"
                      placeholder="e.g. Damaged goods write-off"
                      value={adjForm.reason}
                      onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <Button onClick={handleAdjustment} disabled={isAdjusting} className="w-full">
                    {isAdjusting ? 'Syncing...' : 'Submit Adjustment'}
                  </Button>
                </CardContent>
              </Card>

              {/* Stock Transfer card */}
              <Card>
                <CardHeader>
                  <CardTitle>Stock Transfer (Cin7)</CardTitle>
                  <CardDescription>Move stock between Cin7 locations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="wb-from">From Location</Label>
                      <select
                        id="wb-from"
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                        value={wbTransferForm.from_location_id}
                        onChange={(e) =>
                          setWbTransferForm((f) => ({ ...f, from_location_id: e.target.value }))
                        }
                      >
                        {DEMO_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wb-to">To Location</Label>
                      <select
                        id="wb-to"
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                        value={wbTransferForm.to_location_id}
                        onChange={(e) =>
                          setWbTransferForm((f) => ({ ...f, to_location_id: e.target.value }))
                        }
                      >
                        {DEMO_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wb-sku">SKU</Label>
                    <Input
                      id="wb-sku"
                      placeholder="e.g. TM-2000"
                      value={wbTransferForm.sku}
                      onChange={(e) => setWbTransferForm((f) => ({ ...f, sku: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wb-product-id">Product ID (optional)</Label>
                    <Input
                      id="wb-product-id"
                      placeholder="UUID or leave blank"
                      value={wbTransferForm.product_id}
                      onChange={(e) =>
                        setWbTransferForm((f) => ({ ...f, product_id: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wb-qty">Quantity</Label>
                    <Input
                      id="wb-qty"
                      type="number"
                      min={1}
                      value={wbTransferForm.quantity}
                      onChange={(e) =>
                        setWbTransferForm((f) => ({
                          ...f,
                          quantity: parseInt(e.target.value, 10) || 1,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wb-ref">Reference (optional)</Label>
                    <Input
                      id="wb-ref"
                      placeholder="e.g. Restock store front"
                      value={wbTransferForm.reference}
                      onChange={(e) =>
                        setWbTransferForm((f) => ({ ...f, reference: e.target.value }))
                      }
                    />
                  </div>
                  <AlertDialog open={wbTransferConfirmOpen} onOpenChange={setWbTransferConfirmOpen}>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isWbTransferring} className="w-full">
                        {isWbTransferring ? 'Syncing...' : 'Submit Transfer'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Stock Transfer</AlertDialogTitle>
                        <AlertDialogDescription>
                          Transfer {wbTransferForm.quantity} unit
                          {wbTransferForm.quantity !== 1 ? 's' : ''} of{' '}
                          <strong>{wbTransferForm.sku || wbTransferForm.product_id}</strong> from{' '}
                          <strong>{wbTransferForm.from_location_id}</strong> to{' '}
                          <strong>{wbTransferForm.to_location_id}</strong>. This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            setWbTransferConfirmOpen(false);
                            handleWbTransfer();
                          }}
                        >
                          Confirm Transfer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>

            {/* Recent history table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Write-Backs</CardTitle>
                    <CardDescription>
                      Last 10 adjustments and transfers synced to Cin7.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadWriteBackHistory()}
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory ? 'Loading...' : 'Refresh'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentAdjustments.length === 0 && recentWbTransfers.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    No write-back records yet. Submit an adjustment or transfer above.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 text-left font-medium">Type</th>
                          <th className="py-2 text-left font-medium">SKU</th>
                          <th className="py-2 text-left font-medium">Location(s)</th>
                          <th className="py-2 text-right font-medium">Qty</th>
                          <th className="py-2 text-center font-medium">Status</th>
                          <th className="py-2 text-left font-medium">Cin7 ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {recentAdjustments.map((adj) => (
                          <tr key={adj.id} className="hover:bg-muted/40">
                            <td className="py-2">Adjustment</td>
                            <td className="py-2 font-mono text-xs">{adj.sku}</td>
                            <td className="py-2 text-xs">{adj.location_id}</td>
                            <td className="py-2 text-right font-semibold">{adj.adjustment_qty}</td>
                            <td className="py-2 text-center">
                              <Badge
                                variant={
                                  adj.status === 'synced'
                                    ? 'secondary'
                                    : adj.status === 'failed'
                                      ? 'destructive'
                                      : 'outline'
                                }
                              >
                                {adj.status}
                              </Badge>
                            </td>
                            <td className="text-muted-foreground py-2 font-mono text-xs">
                              {adj.cin7_adjustment_id ?? '-'}
                            </td>
                          </tr>
                        ))}
                        {recentWbTransfers.map((tfr) => (
                          <tr key={tfr.id} className="hover:bg-muted/40">
                            <td className="py-2">Transfer</td>
                            <td className="py-2 font-mono text-xs">{tfr.sku}</td>
                            <td className="py-2 text-xs">
                              {tfr.from_location_id} → {tfr.to_location_id}
                            </td>
                            <td className="py-2 text-right font-semibold">{tfr.quantity}</td>
                            <td className="py-2 text-center">
                              <Badge
                                variant={
                                  tfr.status === 'synced'
                                    ? 'secondary'
                                    : tfr.status === 'failed'
                                      ? 'destructive'
                                      : 'outline'
                                }
                              >
                                {tfr.status}
                              </Badge>
                            </td>
                            <td className="text-muted-foreground py-2 font-mono text-xs">
                              {tfr.cin7_transfer_id ?? '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Stock Take Tab ───────────────────────────────────────────────── */}
          <TabsContent value="stock-take" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Start Stock Take</CardTitle>
                  <CardDescription>
                    Create a physical count session for a warehouse location.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!activeStockTake ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="take-location">Location</Label>
                        <select
                          id="take-location"
                          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                          value={stockTakeLocation}
                          onChange={(e) => setStockTakeLocation(e.target.value as Location)}
                        >
                          {LOCATIONS.map((loc) => (
                            <option key={loc} value={loc} className="capitalize">
                              {loc.charAt(0).toUpperCase() + loc.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        onClick={handleStartStockTake}
                        disabled={isStartingTake}
                        className="w-full"
                      >
                        {isStartingTake ? 'Starting…' : 'Start Stock Take'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="bg-muted/40 flex items-center justify-between rounded-lg px-4 py-2 text-sm">
                        <span>
                          Session:{' '}
                          <span className="font-mono text-xs">
                            {activeStockTake.id.slice(0, 8)}…
                          </span>
                        </span>
                        <Badge variant="secondary" className="capitalize">
                          {activeStockTake.location}
                        </Badge>
                      </div>
                      <div className="max-h-96 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="py-2 text-left font-medium">SKU</th>
                              <th className="py-2 text-left font-medium">Product</th>
                              <th className="py-2 text-right font-medium">System</th>
                              <th className="py-2 text-right font-medium">Counted</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {stockTakeInventory.map((item) => (
                              <tr key={item.product_id} className="hover:bg-muted/40">
                                <td className="py-2 font-mono text-xs">{item.product_sku}</td>
                                <td className="py-2">{item.product_name}</td>
                                <td className="py-2 text-right">{item.stock}</td>
                                <td className="py-2 text-right">
                                  <Input
                                    type="number"
                                    min={0}
                                    className="h-7 w-20 text-right text-sm"
                                    value={stockTakeCounts[item.product_id] ?? 0}
                                    onChange={(e) =>
                                      setStockTakeCounts((c) => ({
                                        ...c,
                                        [item.product_id]: parseInt(e.target.value, 10) || 0,
                                      }))
                                    }
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSubmitStockTake}
                          disabled={isSubmittingTake}
                          className="flex-1"
                        >
                          {isSubmittingTake ? 'Submitting…' : 'Submit Counts'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setActiveStockTake(null);
                            setStockTakeInventory([]);
                            setStockTakeCounts({});
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>How it works</CardTitle>
                  <CardDescription>Physical stock count process.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-4">
                    <p className="font-semibold">1. Select location</p>
                    <p className="text-muted-foreground text-xs">
                      Choose the warehouse location to count.
                    </p>
                  </div>
                  <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-4">
                    <p className="font-semibold">2. Enter counts</p>
                    <p className="text-muted-foreground text-xs">
                      For each product, enter the physically counted quantity. System quantity is
                      shown for reference.
                    </p>
                  </div>
                  <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-4">
                    <p className="font-semibold">3. Submit</p>
                    <p className="text-muted-foreground text-xs">
                      Variances are recorded and stock levels adjusted automatically.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent stock takes history */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Stock Take History</CardTitle>
                    <CardDescription>Recent count sessions.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadStockTakes()}
                    disabled={isLoadingTakes}
                  >
                    {isLoadingTakes ? 'Loading…' : 'Refresh'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentStockTakes.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    No stock takes yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 text-left font-medium">ID</th>
                          <th className="py-2 text-left font-medium">Location</th>
                          <th className="py-2 text-left font-medium">Status</th>
                          <th className="py-2 text-left font-medium">Started</th>
                          <th className="py-2 text-left font-medium">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {recentStockTakes.map((take) => (
                          <tr key={take.id} className="hover:bg-muted/40">
                            <td className="py-2 font-mono text-xs">{take.id.slice(0, 8)}…</td>
                            <td className="py-2 capitalize">{take.location}</td>
                            <td className="py-2">
                              <Badge
                                variant={take.status === 'submitted' ? 'secondary' : 'outline'}
                              >
                                {take.status}
                              </Badge>
                            </td>
                            <td className="text-muted-foreground py-2 text-xs">
                              {new Date(take.created_at).toLocaleString()}
                            </td>
                            <td className="text-muted-foreground py-2 text-xs">
                              {take.submitted_at
                                ? new Date(take.submitted_at).toLocaleString()
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}
