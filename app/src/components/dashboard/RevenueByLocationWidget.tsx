"use client";

import { useState, useEffect, memo } from "react";
import { MapPin, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/lib/api/client";

interface LocationRevenue {
  location: string;
  revenue: number;
  percentage: number;
  order_count: number;
  average_order_value: number;
  growth_percentage: number | null;
}

interface RevenueByLocationData {
  locations: LocationRevenue[];
  total_revenue: number;
  period: string; // e.g., "Last 30 days"
}

// PHASE 4 OPTIMIZATION: Memoized to prevent unnecessary re-renders
export const RevenueByLocationWidget = memo(function RevenueByLocationWidget() {
  const [data, setData] = useState<RevenueByLocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRevenueByLocation() {
      try {
        setLoading(true);
        const response = await apiClient.get<RevenueByLocationData>("/api/dashboard/revenue-by-location");
        setData(response);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load revenue by location data";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchRevenueByLocation();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatLocation = (location: string): string => {
    return location.charAt(0).toUpperCase() + location.slice(1);
  };

  const getLocationColor = (location: string) => {
    switch (location.toLowerCase()) {
      case "brisbane":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "sydney":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "melbourne":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getProgressColor = (location: string) => {
    switch (location.toLowerCase()) {
      case "brisbane":
        return "bg-blue-600";
      case "sydney":
        return "bg-purple-600";
      case "melbourne":
        return "bg-orange-600";
      default:
        return "bg-gray-600";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Revenue by Location
          </CardTitle>
          <CardDescription>Loading location revenue data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Revenue by Location
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasRevenue = data && data.total_revenue > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Revenue by Location
            </CardTitle>
            <CardDescription>
              {data?.period || "Performance"} - {hasRevenue ? formatCurrency(data.total_revenue) : "No revenue"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasRevenue ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No revenue data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total Revenue Summary */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">Total Revenue</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(data.total_revenue)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600 opacity-50" />
              </div>
            </div>

            {/* Location Breakdown */}
            <div className="space-y-4">
              {data.locations.map((location) => (
                <div key={location.location} className="space-y-2">
                  {/* Location Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{formatLocation(location.location)}</span>
                      {location.growth_percentage !== null && (
                        <Badge
                          variant={location.growth_percentage >= 0 ? "default" : "destructive"}
                          className="text-xs"
                        >
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {location.growth_percentage >= 0 ? "+" : ""}
                          {location.growth_percentage.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(location.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{location.percentage.toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative">
                    <Progress
                      value={location.percentage}
                      className={`h-2 ${getProgressColor(location.location)}`}
                    />
                  </div>

                  {/* Location Stats */}
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg border ${getLocationColor(
                      location.location
                    )}`}
                  >
                    <div>
                      <p className="text-xs opacity-75">Orders</p>
                      <p className="font-semibold">{location.order_count}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-75">Avg Order Value</p>
                      <p className="font-semibold">{formatCurrency(location.average_order_value)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Top Performer Badge */}
            {data.locations.length > 0 && (
              <div className="pt-3 border-t">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Top Performer:</span>
                  <span className="font-bold text-green-600">
                    {formatLocation(
                      data.locations.reduce((prev, current) =>
                        prev.revenue > current.revenue ? prev : current
                      ).location
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
