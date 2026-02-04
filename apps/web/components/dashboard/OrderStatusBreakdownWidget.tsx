"use client";

import { useState, useEffect, memo } from "react";
import { ShoppingCart, Package, Truck, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";
import Link from "next/link";

interface OrderStatusCount {
  status: string;
  count: number;
  percentage: number;
}

interface OrderStatusBreakdown {
  total_active_orders: number;
  by_status: OrderStatusCount[];
}

// PHASE 4 OPTIMIZATION: Memoized to prevent unnecessary re-renders
export const OrderStatusBreakdownWidget = memo(function OrderStatusBreakdownWidget() {
  const [data, setData] = useState<OrderStatusBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrderStatus() {
      try {
        setLoading(true);
        const response = await apiClient.get<OrderStatusBreakdown>("/api/dashboard/order-status-breakdown");
        setData(response);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load order status data";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchOrderStatus();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "pending":
        return <ShoppingCart className="h-4 w-4" />;
      case "processing":
        return <Package className="h-4 w-4" />;
      case "shipped":
        return <Truck className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <ShoppingCart className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "processing":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "shipped":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Order Fulfillment
          </CardTitle>
          <CardDescription>Loading order status data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Order Fulfillment
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasOrders = data && data.total_active_orders > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order Fulfillment
            </CardTitle>
            <CardDescription>
              {hasOrders
                ? `${data.total_active_orders} active order${data.total_active_orders > 1 ? "s" : ""} in progress`
                : "No active orders"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasOrders ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active orders at this time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.by_status.map((statusData) => (
              <Link
                key={statusData.status}
                href={`/orders?status=${statusData.status}`}
                className="block"
              >
                <div
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-md ${getStatusColor(
                    statusData.status
                  )}`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(statusData.status)}
                    <div>
                      <p className="font-semibold capitalize">{statusData.status}</p>
                      <p className="text-xs opacity-75">
                        {statusData.count} order{statusData.count > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant="outline" className="font-semibold">
                        {statusData.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="w-24 bg-white/50 rounded-full h-2">
                      <div
                        className="bg-current h-2 rounded-full transition-all"
                        style={{ width: `${statusData.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
