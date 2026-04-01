/**
 * Inventory Forecast Page
 *
 * Detailed view of AI-powered inventory forecasts and reorder recommendations.
 */

'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  Package,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Download,
  Filter,
  Settings2,
  ShoppingCart,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useInventoryForecast, type ProductForecast } from '@/lib/hooks/use-inventory-forecast';
import { inventoryApi } from '@/lib/api/inventory';
import { ReorderRuleDialog } from '../components/ReorderRuleDialog';

export default function InventoryForecastPage() {
  const { toast } = useToast();
  const [forecastDays, setForecastDays] = useState(30);
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [creatingPO, setCreatingPO] = useState<string | null>(null);
  const [ruleTarget, setRuleTarget] = useState<{
    productId: string;
    productName: string;
    productSku: string;
    location: string;
  } | null>(null);

  const { data, loading, error, fetchForecast } = useInventoryForecast({
    forecastDays,
    includeSeasonal: true,
    autoFetch: false,
  });

  // Fetch on mount and when forecast days change
  useEffect(() => {
    fetchForecast();
  }, [fetchForecast, forecastDays]);

  const handleCreatePO = async (productId: string, productName: string) => {
    setCreatingPO(productId);
    try {
      const result = await inventoryApi.triggerAutoReorder(productId, 'brisbane');
      toast({
        title: 'Purchase Order Created',
        description: `PO ${result.po_number} created for ${productName} — ${result.quantity} units (${result.status}).`,
      });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Failed to Create PO',
        description: error instanceof Error ? error.message : 'Could not create purchase order.',
      });
    } finally {
      setCreatingPO(null);
    }
  };

  const handleRefresh = async () => {
    await fetchForecast();
    toast({
      title: 'Forecast Updated',
      description: 'Inventory forecast has been refreshed.',
    });
  };

  const handleExport = () => {
    if (!data) return;

    const csvContent = [
      [
        'Product Name',
        'SKU',
        'Current Stock',
        'Avg Daily Sales',
        'Days Until Depletion',
        'Needs Reorder',
        'Urgency',
        'Recommended Qty',
        'Estimated Cost',
        'Confidence',
      ].join(','),
      ...data.forecasts.map((f) =>
        [
          `"${f.product_name}"`,
          f.sku,
          f.current_stock,
          f.sales_velocity.avg_daily_sales.toFixed(2),
          f.forecast.days_until_depletion || 'N/A',
          f.recommendation.needs_reorder ? 'Yes' : 'No',
          f.recommendation.urgency,
          f.recommendation.recommended_order_qty,
          f.recommendation.estimated_cost?.toFixed(2) || 'N/A',
          (f.confidence * 100).toFixed(0) + '%',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-forecast-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: 'Forecast data has been downloaded as CSV.',
    });
  };

  // Filter forecasts by urgency
  const filteredForecasts =
    urgencyFilter === 'all'
      ? data?.forecasts || []
      : data?.forecasts.filter((f) => f.recommendation.urgency === urgencyFilter) || [];

  const reorderCount = data?.reorder_recommendations.length || 0;
  const criticalCount =
    data?.reorder_recommendations.filter((f) => f.recommendation.urgency === 'critical').length ||
    0;
  const highCount =
    data?.reorder_recommendations.filter((f) => f.recommendation.urgency === 'high').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Forecast</h1>
          <p className="text-muted-foreground">
            AI-powered demand prediction and reorder recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Package className="text-muted-foreground h-4 w-4" />
                Products Analyzed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.total_products_analyzed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Reorder Needed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reorderCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Critical Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{criticalCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Forecast Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(data.confidence * 100)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <Select
              value={forecastDays.toString()}
              onValueChange={(v) => setForecastDays(Number(v))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Forecast Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="low">Low Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Table */}
      {loading && <ForecastTableSkeleton />}

      {error && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">Forecast Failed</h3>
            <p className="text-muted-foreground mb-4">
              {error.message || 'Failed to load forecast. Please try again.'}
            </p>
            <Button onClick={fetchForecast}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Forecast Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Daily Sales</TableHead>
                  <TableHead className="text-right">Days Left</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead className="text-right">Reorder Qty</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredForecasts.map((forecast) => (
                  <ForecastRow
                    key={forecast.product_id}
                    forecast={forecast}
                    onCreatePO={handleCreatePO}
                    onConfigureRule={setRuleTarget}
                  />
                ))}
                {filteredForecasts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center">
                      <Package className="text-muted-foreground mx-auto mb-2 h-12 w-12" />
                      <p className="text-muted-foreground">
                        No forecasts match the selected filters
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {ruleTarget && (
        <ReorderRuleDialog
          open={!!ruleTarget}
          onOpenChange={(open) => {
            if (!open) setRuleTarget(null);
          }}
          productId={ruleTarget.productId}
          productName={ruleTarget.productName}
          productSku={ruleTarget.productSku}
          location={ruleTarget.location}
          onSuccess={() => setRuleTarget(null)}
        />
      )}
    </div>
  );
}

function ForecastRow({
  forecast,
  onCreatePO,
  onConfigureRule,
}: {
  forecast: ProductForecast;
  onCreatePO: (productId: string, productName: string) => void;
  onConfigureRule: (target: {
    productId: string;
    productName: string;
    productSku: string;
    location: string;
  }) => void;
}) {
  const urgencyBadge = {
    critical: 'destructive',
    high: 'destructive',
    medium: 'secondary',
    low: 'secondary',
  } as const;

  const daysUntilDepletion = forecast.forecast.days_until_depletion;

  return (
    <TableRow>
      <TableCell>
        <div>
          <div className="font-medium">{forecast.product_name}</div>
          <div className="text-muted-foreground text-sm">{forecast.sku}</div>
        </div>
      </TableCell>
      <TableCell className="text-right">{forecast.current_stock}</TableCell>
      <TableCell className="text-right">
        {forecast.sales_velocity.avg_daily_sales.toFixed(2)}
      </TableCell>
      <TableCell className="text-right">
        {daysUntilDepletion !== null ? (
          <span>{daysUntilDepletion}</span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={urgencyBadge[forecast.recommendation.urgency]}>
          {forecast.recommendation.urgency}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {forecast.recommendation.needs_reorder ? (
          <span className="font-medium">{forecast.recommendation.recommended_order_qty}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {forecast.recommendation.estimated_cost ? (
          <span>${forecast.recommendation.estimated_cost.toLocaleString()}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Badge variant="outline">{Math.round(forecast.confidence * 100)}%</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {forecast.recommendation.needs_reorder && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => onCreatePO(forecast.product_id, forecast.product_name)}
            >
              <ShoppingCart className="mr-1 h-3 w-3" />
              Create PO
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Configure reorder rule"
            onClick={() =>
              onConfigureRule({
                productId: forecast.product_id,
                productName: forecast.product_name,
                productSku: forecast.sku,
                location: 'brisbane',
              })
            }
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ForecastTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
