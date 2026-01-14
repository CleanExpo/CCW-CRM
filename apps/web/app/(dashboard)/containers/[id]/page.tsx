"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import {
  Ship,
  Package,
  Clock,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Box,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ContainerItem {
  id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_preallocated: number;
  quantity_available: number;
  unit_cost: string | null;
  total_cost: string | null;
}

interface Container {
  id: string;
  container_number: string;
  vessel_name: string | null;
  voyage_number: string | null;
  origin_port: string | null;
  destination_port: string | null;
  destination_warehouse: string;
  booking_date: string | null;
  departure_date: string | null;
  estimated_arrival_date: string | null;
  actual_arrival_date: string | null;
  customs_clearance_date: string | null;
  delivered_date: string | null;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  tracking_url: string | null;
  shipping_cost: string | null;
  customs_duty: string | null;
  other_charges: string | null;
  total_cost: string;
  notes: string | null;
  internal_notes: string | null;
  is_overdue: boolean;
  days_until_arrival: number | null;
  items: ContainerItem[];
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES = {
  booked: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_transit: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  at_port: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  customs_clearance: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  cleared: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  out_for_delivery: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const STATUS_LABELS = {
  booked: "Booked",
  in_transit: "In Transit",
  at_port: "At Port",
  customs_clearance: "Customs Clearance",
  cleared: "Cleared",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function ContainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [container, setContainer] = useState<Container | null>(null);
  const [loading, setLoading] = useState(true);
  const [containerId, setContainerId] = useState<string>("");

  useEffect(() => {
    params.then((resolvedParams) => {
      setContainerId(resolvedParams.id);
    });
  }, [params]);

  useEffect(() => {
    if (containerId) {
      fetchContainer();
    }
  }, [containerId]);

  const fetchContainer = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Container>(`/api/containers/${containerId}`);
      setContainer(response);
    } catch (error: any) {
      console.error("Failed to fetch container:", error);
      toast({
        title: "Error",
        description: "Failed to load container details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!container) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px]">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Container Not Found</h2>
        <p className="text-muted-foreground mb-4">The container you're looking for doesn't exist.</p>
        <Button onClick={() => router.push("/containers")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Containers
        </Button>
      </div>
    );
  }

  const totalItems = container.items.reduce((sum, item) => sum + item.quantity_ordered, 0);
  const totalPreallocated = container.items.reduce((sum, item) => sum + item.quantity_preallocated, 0);
  const totalAvailable = container.items.reduce((sum, item) => sum + item.quantity_available, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/containers")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{container.container_number}</h1>
            <p className="text-muted-foreground">
              {container.vessel_name} • {container.voyage_number}
            </p>
          </div>
        </div>
        <Badge className={STATUS_STYLES[container.status as keyof typeof STATUS_STYLES]}>
          {STATUS_LABELS[container.status as keyof typeof STATUS_LABELS]}
        </Badge>
      </div>

      {/* Overdue Alert */}
      {container.is_overdue && (
        <div className="flex items-center gap-2 p-4 border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            This container is overdue. Expected arrival date has passed.
          </p>
        </div>
      )}

      {/* Shipment Details */}
      <Card>
        <CardHeader>
          <CardTitle>Shipment Details</CardTitle>
          <CardDescription>Container routing and tracking information</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Route</p>
                <p className="text-sm text-muted-foreground">
                  {container.origin_port} → {container.destination_port}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Destination Warehouse</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {container.destination_warehouse}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Ship className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Tracking</p>
                {container.tracking_url ? (
                  <a
                    href={container.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {container.tracking_number} ({container.carrier})
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {container.tracking_number || "No tracking available"}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Key Dates</p>
                <div className="space-y-1 mt-1">
                  {container.booking_date && (
                    <p className="text-sm text-muted-foreground">
                      Booked: {format(new Date(container.booking_date), "MMM d, yyyy")}
                    </p>
                  )}
                  {container.departure_date && (
                    <p className="text-sm text-muted-foreground">
                      Departed: {format(new Date(container.departure_date), "MMM d, yyyy")}
                    </p>
                  )}
                  {container.estimated_arrival_date && (
                    <p className="text-sm text-muted-foreground">
                      ETA: {format(new Date(container.estimated_arrival_date), "MMM d, yyyy")}
                      {container.days_until_arrival !== null && (
                        <span className="ml-1">
                          ({container.days_until_arrival} days)
                        </span>
                      )}
                    </p>
                  )}
                  {container.actual_arrival_date && (
                    <p className="text-sm text-muted-foreground">
                      Arrived: {format(new Date(container.actual_arrival_date), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Information */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
          <CardDescription>Shipping and customs charges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {container.shipping_cost && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Shipping Cost</span>
                <span className="text-sm font-medium">${parseFloat(container.shipping_cost).toFixed(2)}</span>
              </div>
            )}
            {container.customs_duty && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Customs Duty</span>
                <span className="text-sm font-medium">${parseFloat(container.customs_duty).toFixed(2)}</span>
              </div>
            )}
            {container.other_charges && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Other Charges</span>
                <span className="text-sm font-medium">${parseFloat(container.other_charges).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm font-semibold">Total Cost</span>
              <span className="text-sm font-semibold">${parseFloat(container.total_cost).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Container Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Container Items</CardTitle>
              <CardDescription>
                {container.items.length} products • {totalItems} units total
              </CardDescription>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <span className="text-muted-foreground">{totalPreallocated} Pre-allocated</span>
              </div>
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">{totalAvailable} Available</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {container.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">Product {item.product_id.substring(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">
                    Ordered: {item.quantity_ordered} • Received: {item.quantity_received} •
                    Damaged: {item.quantity_ordered - item.quantity_received - item.quantity_preallocated}
                  </p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Pre-allocated</p>
                    <p className="font-medium text-orange-600">{item.quantity_preallocated}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="font-medium text-green-600">{item.quantity_available}</p>
                  </div>
                  {item.total_cost && (
                    <div>
                      <p className="text-xs text-muted-foreground">Value</p>
                      <p className="font-medium">${parseFloat(item.total_cost).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(container.notes || container.internal_notes) && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {container.notes && (
              <div>
                <p className="text-sm font-medium mb-1">Customer Notes</p>
                <p className="text-sm text-muted-foreground">{container.notes}</p>
              </div>
            )}
            {container.internal_notes && (
              <div>
                <p className="text-sm font-medium mb-1">Internal Notes</p>
                <p className="text-sm text-muted-foreground">{container.internal_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
