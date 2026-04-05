/**
 * Inventory Forecast Widget
 *
 * Dashboard widget showing AI-powered inventory forecasts and reorder recommendations.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  TrendingUp,
  Package,
  Calendar,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLowStockForecast, type ProductForecast } from '@/hooks/use-inventory-forecast';

interface InventoryForecastWidgetProps {
  thresholdDays?: number;
}

export function InventoryForecastWidget({ thresholdDays = 30 }: InventoryForecastWidgetProps) {
  const { data, loading, error, fetchForecast } = useLowStockForecast(thresholdDays);

  // Fetch on mount
  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  if (loading) {
    return <InventoryForecastWidgetSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4" />
            Inventory Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Failed to load forecast. Please try again.
          </p>
          <Button variant="outline" size="sm" onClick={fetchForecast} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const reorderCount = data?.reorder_recommendations.length || 0;
  const criticalCount =
    data?.reorder_recommendations.filter((f) => f.recommendation.urgency === 'critical').length ||
    0;

  const highCount =
    data?.reorder_recommendations.filter((f) => f.recommendation.urgency === 'high').length || 0;

  const topRecommendations = data?.reorder_recommendations.slice(0, 3) || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            Inventory Forecast
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchForecast}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Reorder Needed</span>
            <span className="font-semibold">{reorderCount} products</span>
          </div>

          {criticalCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">
                {criticalCount} critical alert{criticalCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {highCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 p-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-700">{highCount} high priority</span>
            </div>
          )}
        </div>

        {/* Top Recommendations */}
        {topRecommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-muted-foreground text-xs font-semibold uppercase">
              Top Recommendations
            </h4>
            {topRecommendations.map((forecast) => (
              <ForecastItem key={forecast.product_id} forecast={forecast} />
            ))}
          </div>
        )}

        {/* No recommendations */}
        {reorderCount === 0 && (
          <div className="py-4 text-center">
            <Package className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">All products well-stocked</p>
            <p className="text-muted-foreground mt-1 text-xs">
              No reorders needed within {thresholdDays} days
            </p>
          </div>
        )}

        {/* View All Link */}
        {reorderCount > 3 && (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/inventory/forecast">
              View All Forecasts
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}

        {/* Confidence Score */}
        {data && data.confidence > 0 && (
          <div className="border-t pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Forecast Confidence</span>
              <Badge variant="secondary">{Math.round(data.confidence * 100)}%</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ForecastItem({ forecast }: { forecast: ProductForecast }) {
  const urgencyColor = {
    critical: 'text-red-600 bg-red-50 border-red-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    low: 'text-green-600 bg-green-50 border-green-200',
  };

  const urgencyBadge = {
    critical: 'destructive',
    high: 'destructive',
    medium: 'secondary',
    low: 'secondary',
  } as const;

  const daysUntilDepletion = forecast.forecast.days_until_depletion;

  return (
    <div className={`rounded-md border p-2 ${urgencyColor[forecast.recommendation.urgency]}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{forecast.product_name}</p>
          <p className="text-muted-foreground text-xs">{forecast.sku}</p>
        </div>
        <Badge variant={urgencyBadge[forecast.recommendation.urgency]} className="ml-2">
          {forecast.recommendation.urgency}
        </Badge>
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3" />
          <span>{forecast.current_stock} left</span>
        </div>

        {daysUntilDepletion !== null && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{daysUntilDepletion} days</span>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs font-medium">
        Order {forecast.recommendation.recommended_order_qty} units
        {forecast.recommendation.estimated_cost && (
          <span className="text-muted-foreground ml-1">
            (~${forecast.recommendation.estimated_cost.toLocaleString()})
          </span>
        )}
      </div>
    </div>
  );
}

function InventoryForecastWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4" />
          Inventory Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
