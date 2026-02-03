/**
 * Inventory Forecast Widget
 *
 * Dashboard widget showing AI-powered inventory forecasts and reorder recommendations.
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  TrendingUp,
  Package,
  Calendar,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLowStockForecast,
  type ProductForecast,
} from "@/lib/hooks/use-inventory-forecast";

interface InventoryForecastWidgetProps {
  thresholdDays?: number;
}

export function InventoryForecastWidget({
  thresholdDays = 30,
}: InventoryForecastWidgetProps) {
  const { data, loading, error, fetchForecast } =
    useLowStockForecast(thresholdDays);

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
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load forecast. Please try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchForecast}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const reorderCount = data?.reorder_recommendations.length || 0;
  const criticalCount =
    data?.reorder_recommendations.filter(
      (f) => f.recommendation.urgency === "critical"
    ).length || 0;

  const highCount =
    data?.reorder_recommendations.filter(
      (f) => f.recommendation.urgency === "high"
    ).length || 0;

  const topRecommendations = data?.reorder_recommendations.slice(0, 3) || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
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
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700 font-medium">
                {criticalCount} critical alert{criticalCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {highCount > 0 && (
            <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-700 font-medium">
                {highCount} high priority
              </span>
            </div>
          )}
        </div>

        {/* Top Recommendations */}
        {topRecommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">
              Top Recommendations
            </h4>
            {topRecommendations.map((forecast) => (
              <ForecastItem key={forecast.product_id} forecast={forecast} />
            ))}
          </div>
        )}

        {/* No recommendations */}
        {reorderCount === 0 && (
          <div className="text-center py-4">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              All products well-stocked
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              No reorders needed within {thresholdDays} days
            </p>
          </div>
        )}

        {/* View All Link */}
        {reorderCount > 3 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            asChild
          >
            <Link href={"/inventory/forecast" as any}>
              View All Forecasts
              <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        )}

        {/* Confidence Score */}
        {data && data.confidence > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Forecast Confidence</span>
              <Badge variant="secondary">
                {Math.round(data.confidence * 100)}%
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ForecastItem({ forecast }: { forecast: ProductForecast }) {
  const urgencyColor = {
    critical: "text-red-600 bg-red-50 border-red-200",
    high: "text-orange-600 bg-orange-50 border-orange-200",
    medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
    low: "text-green-600 bg-green-50 border-green-200",
  };

  const urgencyBadge = {
    critical: "destructive",
    high: "destructive",
    medium: "secondary",
    low: "secondary",
  } as const;

  const daysUntilDepletion = forecast.forecast.days_until_depletion;

  return (
    <div
      className={`p-2 border rounded-md ${urgencyColor[forecast.recommendation.urgency]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{forecast.product_name}</p>
          <p className="text-xs text-muted-foreground">{forecast.sku}</p>
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
        <CardTitle className="text-sm font-medium flex items-center gap-2">
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
