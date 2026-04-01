"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { useRealTimeContainers } from "@/hooks/use-real-time-containers";
import {
  Ship,
  Package,
  Clock,
  MapPin,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  Plus,
  Eye,
  Truck,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Container {
  id: string;
  container_number: string;
  vessel_name: string | null;
  voyage_number: string | null;
  origin_port: string | null;
  destination_port: string | null;
  destination_warehouse: string;
  estimated_arrival_date: string | null;
  actual_arrival_date: string | null;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  is_overdue: boolean;
  days_until_arrival: number | null;
  items: Array<{
    id: string;
    product_id: string;
    quantity_ordered: number;
    quantity_received: number;
    quantity_preallocated: number;
    quantity_available: number;
  }>;
  backorders: Array<{
    id: string;
    quantity_backordered: number;
  }>;
}

interface ContainerListResponse {
  items: Container[];
  total: number;
  page: number;
  page_size: number;
}

const statusConfig = {
  booked: {
    variant: "secondary" as const,
    icon: Calendar,
    label: "Booked",
    color: "text-muted-foreground",
  },
  in_transit: {
    variant: "processing" as const,
    icon: Ship,
    label: "In Transit",
    color: "text-info",
  },
  at_port: {
    variant: "processing" as const,
    icon: MapPin,
    label: "At Port",
    color: "text-info",
  },
  customs_clearance: {
    variant: "pending" as const,
    icon: AlertCircle,
    label: "Customs",
    color: "text-warning",
  },
  cleared: {
    variant: "delivered" as const,
    icon: CheckCircle,
    label: "Cleared",
    color: "text-success",
  },
  out_for_delivery: {
    variant: "processing" as const,
    icon: Truck,
    label: "Out for Delivery",
    color: "text-info",
  },
  delivered: {
    variant: "delivered" as const,
    icon: CheckCircle,
    label: "Delivered",
    color: "text-success",
  },
  cancelled: {
    variant: "destructive" as const,
    icon: AlertCircle,
    label: "Cancelled",
    color: "text-error",
  },
};

export default function ContainersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"arriving" | "in_transit" | "all">("arriving");

  const loadContainers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (activeTab === "arriving") {
        params.append("arriving_soon", "true");
      } else if (activeTab === "in_transit") {
        params.append("status", "in_transit");
      }

      const response = await apiClient.get<ContainerListResponse>(
        `/api/containers?${params.toString()}`
      );
      setContainers(response.items);
    } catch (error: any) {
      console.error("Failed to load containers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load containers",
      });
      setContainers([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

  // Enable real-time container updates via WebSocket
  useRealTimeContainers({
    showNotifications: true,
    onContainerUpdate: loadContainers,
  });

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  const arrivingSoonCount = containers.filter((c) => {
    if (!c.estimated_arrival_date || c.status === "delivered") return false;
    const daysUntil = c.days_until_arrival ?? 999;
    return daysUntil >= 0 && daysUntil <= 14;
  }).length;

  const overdueCount = containers.filter((c) => c.is_overdue).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Container Tracking
          </h1>
          <p className="text-muted-foreground">
            {arrivingSoonCount > 0
              ? `${arrivingSoonCount} ${arrivingSoonCount === 1 ? "container" : "containers"} arriving soon`
              : "Track incoming shipments and ETAs"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadContainers} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Clock className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button variant="gradient" onClick={() => router.push("/containers/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Container
          </Button>
        </div>
      </div>

      {overdueCount > 0 && (
        <Card variant="elevated" className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {overdueCount} {overdueCount === 1 ? "container is" : "containers are"} overdue
              </p>
              <p className="text-sm text-muted-foreground">
                Please check with carriers for updated arrival information
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="arriving">
            Arriving Soon
            {arrivingSoonCount > 0 && (
              <Badge variant="default" className="ml-2 px-1.5 py-0 text-xs">
                {arrivingSoonCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_transit">In Transit</TabsTrigger>
          <TabsTrigger value="all">All Containers</TabsTrigger>
        </TabsList>

        <TabsContent value="arriving" className="mt-6">
          <ContainersList
            containers={containers}
            loading={loading}
            onRefresh={loadContainers}
          />
        </TabsContent>

        <TabsContent value="in_transit" className="mt-6">
          <ContainersList
            containers={containers}
            loading={loading}
            onRefresh={loadContainers}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <ContainersList
            containers={containers}
            loading={loading}
            onRefresh={loadContainers}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ContainersListProps {
  containers: Container[];
  loading: boolean;
  onRefresh: () => void;
}

function ContainersList({ containers, loading, onRefresh }: ContainersListProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <Card variant="elevated">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-brand-primary-100 p-4 mb-4 dark:bg-brand-primary-950">
            <Ship className="h-10 w-10 text-brand-primary-600 dark:text-brand-primary-400" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            No containers found
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Create a new container to start tracking incoming shipments
          </p>
          <Button
            variant="gradient"
            className="mt-4"
            onClick={() => router.push("/containers/new")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Container
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {containers.map((container) => {
        const statusInfo = statusConfig[container.status as keyof typeof statusConfig] || statusConfig.booked;
        const StatusIcon = statusInfo.icon;
        const totalItems = container.items.reduce((sum, item) => sum + item.quantity_ordered, 0);
        const preallocatedItems = container.items.reduce((sum, item) => sum + item.quantity_preallocated, 0);

        return (
          <Card
            key={container.id}
            variant="elevated"
            className={cn(
              "transition-all hover:shadow-lg cursor-pointer",
              container.is_overdue && "border-l-4 border-l-warning/50 bg-warning/5"
            )}
            onClick={() => router.push(`/containers/${container.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn(
                    "rounded-lg p-2 mt-1",
                    container.status === "delivered" ? "bg-success/10" :
                    container.status === "in_transit" ? "bg-info/10" :
                    container.is_overdue ? "bg-warning/10" :
                    "bg-muted"
                  )}>
                    <StatusIcon className={cn(
                      "h-5 w-5",
                      statusInfo.color
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xl">
                      {container.container_number}
                    </CardTitle>
                    {container.vessel_name && (
                      <CardDescription className="mt-1">
                        {container.vessel_name}
                        {container.voyage_number && ` • Voyage ${container.voyage_number}`}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={statusInfo.variant} icon={StatusIcon}>
                    {statusInfo.label}
                  </Badge>
                  {container.is_overdue && (
                    <Badge variant="pending" icon={AlertCircle}>
                      Overdue
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Route Information */}
              <div className="flex items-center gap-4 text-sm">
                {container.origin_port && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{container.origin_port}</span>
                  </div>
                )}
                {container.origin_port && container.destination_port && (
                  <span className="text-muted-foreground">→</span>
                )}
                {container.destination_port && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{container.destination_port}</span>
                  </div>
                )}
              </div>

              {/* ETA Information */}
              {container.estimated_arrival_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">ETA:</span>
                  <span className={cn(
                    "font-medium",
                    container.is_overdue ? "text-warning" : "text-foreground"
                  )}>
                    {format(new Date(container.estimated_arrival_date), "PPP")}
                  </span>
                  {container.days_until_arrival !== null && container.days_until_arrival >= 0 && (
                    <Badge variant="outline" className="ml-2">
                      {container.days_until_arrival} {container.days_until_arrival === 1 ? "day" : "days"}
                    </Badge>
                  )}
                </div>
              )}

              {/* Actual Arrival (if delivered) */}
              {container.actual_arrival_date && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-muted-foreground">Arrived:</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(container.actual_arrival_date), "PPP")}
                  </span>
                </div>
              )}

              {/* Container Contents */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {container.items.length} {container.items.length === 1 ? "product" : "products"}
                    </span>
                    <span className="text-foreground font-medium">
                      ({totalItems} units)
                    </span>
                  </div>
                  {preallocatedItems > 0 && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-brand-primary-600" />
                      <span className="text-brand-primary-600 font-medium">
                        {preallocatedItems} pre-allocated
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {container.destination_warehouse}
                  </Badge>
                  {container.backorders.length > 0 && (
                    <Badge variant="default">
                      {container.backorders.length} {container.backorders.length === 1 ? "backorder" : "backorders"}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tracking Link */}
              {container.tracking_number && container.carrier && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                  <Truck className="h-4 w-4" />
                  <span>Tracking:</span>
                  <span className="font-mono text-foreground">{container.tracking_number}</span>
                  <span>•</span>
                  <span className="capitalize">{container.carrier}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/containers/${container.id}`);
                  }}
                >
                  <Eye className="mr-2 h-3 w-3" />
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
