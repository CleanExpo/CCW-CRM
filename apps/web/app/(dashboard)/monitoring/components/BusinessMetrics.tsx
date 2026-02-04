"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  DollarSign,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Package,
  Clock,
} from "lucide-react";
import { getBusinessMetrics, type BusinessMetrics as BusinessMetricsType } from "@/lib/api/monitoring";

export function BusinessMetrics() {
  const [metrics, setMetrics] = useState<BusinessMetricsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadMetrics() {
    try {
      const data = await getBusinessMetrics();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load business metrics");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading business metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const { pos, reconciliation, orders } = metrics;

  return (
    <div className="space-y-6">
      {/* POS Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3">POS System</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={DollarSign}
            label="Today's Volume"
            value={`$${pos.today.total_volume.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            subtext={`${pos.today.transaction_count} transactions`}
            status="neutral"
          />
          <MetricCard
            icon={TrendingUp}
            label="Average Transaction"
            value={`$${pos.today.average_value.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            status="neutral"
          />
          <MetricCard
            icon={ShoppingCart}
            label="This Week"
            value={pos.this_week.transaction_count.toLocaleString()}
            subtext={`$${pos.this_week.total_volume.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}`}
            status="neutral"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Payment Failures (24h)"
            value={pos.payment_failures_24h.toString()}
            subtext={`${pos.failure_rate_percent.toFixed(1)}% failure rate`}
            status={
              pos.failure_rate_percent > 5
                ? "critical"
                : pos.failure_rate_percent > 2
                ? "warning"
                : "good"
            }
          />
        </div>
      </div>

      {/* Reconciliation Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Bank Reconciliation</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={CheckCircle2}
            label="Success Rate (7d)"
            value={`${reconciliation.success_rate_percent.toFixed(1)}%`}
            subtext={`${reconciliation.reconciled_7d} of ${reconciliation.total_feeds_7d}`}
            status={
              reconciliation.success_rate_percent >= 95
                ? "good"
                : reconciliation.success_rate_percent >= 80
                ? "warning"
                : "critical"
            }
          />
          <MetricCard
            icon={CreditCard}
            label="Unreconciled Total"
            value={reconciliation.unreconciled_total.toString()}
            status={
              reconciliation.unreconciled_total > 50
                ? "warning"
                : reconciliation.unreconciled_total > 100
                ? "critical"
                : "good"
            }
          />
          <MetricCard
            icon={TrendingUp}
            label="Reconciled (7d)"
            value={reconciliation.reconciled_7d.toString()}
            status="neutral"
          />
          <MetricCard
            icon={Clock}
            label="Total Feeds (7d)"
            value={reconciliation.total_feeds_7d.toString()}
            status="neutral"
          />
        </div>
      </div>

      {/* Order Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Orders</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Package}
            label="Today's Orders"
            value={orders.today_count.toString()}
            status="neutral"
          />
          <MetricCard
            icon={TrendingUp}
            label="This Week"
            value={orders.this_week.count.toString()}
            subtext={`$${orders.this_week.total_value.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}`}
            status="neutral"
          />
          <MetricCard
            icon={DollarSign}
            label="Average Order Value"
            value={`$${orders.this_week.average_value.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            status="neutral"
          />
          <MetricCard
            icon={Clock}
            label="Orders/Hour (24h)"
            value={orders.orders_per_hour_24h.toFixed(1)}
            status="neutral"
          />
        </div>

        {/* Orders by Status */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Orders by Status</CardTitle>
            <CardDescription>Current order distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatusBadge label="Draft" count={orders.by_status.draft} variant="secondary" />
              <StatusBadge label="Pending" count={orders.by_status.pending} variant="default" />
              <StatusBadge
                label="Confirmed"
                count={orders.by_status.confirmed}
                variant="default"
              />
              <StatusBadge
                label="Processing"
                count={orders.by_status.processing}
                variant="default"
              />
              <StatusBadge label="Shipped" count={orders.by_status.shipped} variant="default" />
              <StatusBadge
                label="Delivered"
                count={orders.by_status.delivered}
                variant="outline"
              />
              <StatusBadge
                label="Cancelled"
                count={orders.by_status.cancelled}
                variant="destructive"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  status,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  subtext?: string;
  status: "good" | "warning" | "critical" | "neutral";
}) {
  const statusColor = {
    good: "text-green-600",
    warning: "text-yellow-600",
    critical: "text-red-600",
    neutral: "text-foreground",
  }[status];

  const bgColor = {
    good: "bg-green-500/10",
    warning: "bg-yellow-500/10",
    critical: "bg-red-500/10",
    neutral: "bg-muted",
  }[status];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`rounded p-1.5 ${bgColor}`}>
            <Icon className={`h-4 w-4 ${statusColor}`} />
          </div>
          <span className="text-xs text-muted-foreground truncate">{label}</span>
        </div>
        <p className={`text-xl font-semibold ${statusColor}`}>{value}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "default" | "secondary" | "destructive" | "outline";
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-lg border bg-card">
      <Badge variant={variant} className="text-xs">
        {label}
      </Badge>
      <span className="text-lg font-semibold">{count}</span>
    </div>
  );
}
