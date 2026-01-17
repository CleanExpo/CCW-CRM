"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ClipboardCheck,
  Clock,
  Package,
  RefreshCw,
  Sparkles,
  Truck,
} from "lucide-react";

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

const priorityBadge = (priority: string) => {
  switch (priority) {
    case "rush":
    case "high":
      return "destructive";
    case "normal":
      return "secondary";
    default:
      return "outline";
  }
};

const statusBadge = (status: string) => {
  if (status === "in_progress" || status === "picking") return "processing";
  if (status === "inspection") return "pending";
  return "outline";
};

export default function WarehouseOpsPage() {
  const [data, setData] = useState<WarehouseOpsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/warehouse/ops", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Warehouse ops feed is unavailable.");
      }
      const payload = (await response.json()) as WarehouseOpsPayload;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load warehouse ops.");
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Warehouse Operations</h1>
          <p className="text-muted-foreground">
            Receiving, pick/pack, and returns in one queue with AI-guided priorities.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadOps} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/inventory">Open inventory</Link>
          </Button>
          <Button variant="gradient" asChild>
            <Link href="/containers">Start receiving</Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{lastUpdated ? `Updated ${lastUpdated}` : "Loading latest signal..."}</span>
        {error ? <Badge variant="destructive">{error}</Badge> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbound today</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.inboundToday ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.inboundDocked ?? 0} docked, {metrics?.inboundScheduled ?? 0} scheduled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Picks due today</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.picksDueToday ?? 0}</div>
            <p className="text-xs text-muted-foreground">{metrics?.rushPicks ?? 0} rush order</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Returns & service</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.returnsOpen ?? 0}</div>
            <p className="text-xs text-muted-foreground">{metrics?.returnSlaRisk ?? 0} SLA risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-time rate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.onTimeRate ?? 0}%</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

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
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{shipment.id}</p>
                    <p className="text-xs text-muted-foreground">{shipment.supplier}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{shipment.container}</span>
                      <span>{shipment.items} items</span>
                      <span>{shipment.dock}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{shipment.eta}</p>
                    <div className="mt-1 flex items-center gap-2 justify-end">
                      <Badge variant={statusBadge(shipment.status)}>{shipment.status.replace("_", " ")}</Badge>
                      <Badge variant={priorityBadge(shipment.priority)}>{shipment.priority}</Badge>
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
                  <CardTitle>Pick & pack queue</CardTitle>
                  <CardDescription>Orders staged for picking and packing.</CardDescription>
                </div>
                <Badge variant="outline">{pickQueue.length} picks</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {pickQueue.map((pick) => (
                <div
                  key={pick.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{pick.id}</p>
                    <p className="text-xs text-muted-foreground">{pick.customer}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{pick.zone}</span>
                      <span>{pick.lines} lines</span>
                      <span>Promised {pick.promised}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{pick.status}</p>
                    <div className="mt-1 flex items-center gap-2 justify-end">
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
                  <CardTitle>Returns & service</CardTitle>
                  <CardDescription>Warehouse CRM follow-ups and SLAs.</CardDescription>
                </div>
                <Badge variant="outline">{returnsQueue.length} cases</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {returnsQueue.map((rma) => (
                <div
                  key={rma.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{rma.id}</p>
                    <p className="text-xs text-muted-foreground">{rma.customer}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{rma.reason}</span>
                      <span>{rma.items} items</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{rma.sla}</p>
                    <div className="mt-1 flex items-center gap-2 justify-end">
                      <Badge variant={statusBadge(rma.status)}>{rma.status.replace("_", " ")}</Badge>
                      {rma.sla.includes("4h") ? (
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
          <Card variant="gradient" className="text-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <CardTitle className="text-white">AI warehouse guidance</CardTitle>
              </div>
              <CardDescription className="text-white/70">
                Priority insights for shift leads and warehouse CRM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiGuidance.map((item) => (
                <div key={item.title} className="rounded-lg border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-white/70">{item.detail}</p>
                  <p className="mt-2 text-xs font-semibold text-white">{item.impact}</p>
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
                <AlertTriangle className="h-4 w-4 text-warning" />
                <CardTitle>Operational risks</CardTitle>
              </div>
              <CardDescription>Issues that need immediate attention.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">Backorder exposure</p>
                    <p className="text-xs text-muted-foreground">
                      3 SKUs are below reorder point with open quotes.
                    </p>
                  </div>
                  <Badge variant="destructive">High</Badge>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">Pending quality checks</p>
                    <p className="text-xs text-muted-foreground">
                      2 inbound pallets are waiting on QA sign-off.
                    </p>
                  </div>
                  <Badge variant="secondary">Medium</Badge>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Next review</span>
                <span className="text-xs font-semibold">Today 3:30 PM</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
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
    </div>
  );
}
