"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  User,
  Bell,
  Ship,
  TrendingUp,
  Eye,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Backorder {
  id: string;
  order_id: string;
  product_id: string;
  customer_id: string | null;
  quantity_backordered: number;
  quantity_fulfilled: number;
  quantity_remaining: number;
  fulfillment_location: string;
  container_id: string | null;
  expected_availability_date: string | null;
  original_order_date: string;
  status: string;
  customer_notified: boolean;
  last_notification_date: string | null;
  notification_count: number;
  priority: number;
  is_overdue: boolean;
  days_until_available: number | null;
  days_outstanding: number;
  product: {
    sku: string;
    name: string;
  } | null;
  customer: {
    name: string;
    email: string;
  } | null;
  container: {
    container_number: string;
    estimated_arrival_date: string | null;
  } | null;
}

interface BackorderListResponse {
  items: Backorder[];
  total: number;
  page: number;
  page_size: number;
}

const statusConfig = {
  pending: {
    variant: "pending" as const,
    icon: Clock,
    label: "Pending",
    color: "text-warning",
  },
  allocated: {
    variant: "processing" as const,
    icon: Ship,
    label: "Allocated",
    color: "text-info",
  },
  ready: {
    variant: "success" as const,
    icon: CheckCircle,
    label: "Ready",
    color: "text-success",
  },
  fulfilled: {
    variant: "success" as const,
    icon: CheckCircle,
    label: "Fulfilled",
    color: "text-success",
  },
  cancelled: {
    variant: "destructive" as const,
    icon: AlertCircle,
    label: "Cancelled",
    color: "text-error",
  },
};

export default function BackordersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "allocated" | "all">("pending");
  const [selectedBackorder, setSelectedBackorder] = useState<Backorder | null>(null);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  async function loadBackorders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (activeTab === "pending") {
        params.append("status", "pending");
      } else if (activeTab === "allocated") {
        params.append("status", "allocated");
      }

      const response = await apiClient.get<BackorderListResponse>(
        `/api/backorders?${params.toString()}`
      );
      setBackorders(response.items);
    } catch (error: any) {
      console.error("Failed to load backorders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load backorders",
      });
      setBackorders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBackorders();

    // Auto-refresh every 60 seconds
    const interval = setInterval(loadBackorders, 60000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleNotifyCustomer = async () => {
    if (!selectedBackorder) return;

    setProcessing(true);
    try {
      await apiClient.post(`/api/backorders/${selectedBackorder.id}/notify`, {
        notification_type: "eta_update",
      });

      toast({
        title: "Customer Notified",
        description: "Customer has been sent an email with ETA update.",
      });

      setNotifyDialogOpen(false);
      setSelectedBackorder(null);
      loadBackorders();
    } catch (error: any) {
      console.error("Failed to notify customer:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send notification",
      });
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = backorders.filter((b) => b.status === "pending").length;
  const overdueCount = backorders.filter((b) => b.is_overdue).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Backorders
          </h1>
          <p className="text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} ${pendingCount === 1 ? "backorder" : "backorders"} awaiting fulfillment`
              : "Track unfulfilled orders and manage customer expectations"}
          </p>
        </div>
        <Button variant="outline" onClick={loadBackorders} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Clock className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {overdueCount > 0 && (
        <Card variant="elevated" className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {overdueCount} {overdueCount === 1 ? "backorder is" : "backorders are"} overdue
              </p>
              <p className="text-sm text-muted-foreground">
                Expected availability dates have passed. Please update ETAs and notify customers.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="pending">
            Pending
            {pendingCount > 0 && (
              <Badge variant="default" className="ml-2 px-1.5 py-0 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="allocated">Allocated</TabsTrigger>
          <TabsTrigger value="all">All Backorders</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <BackordersList
            backorders={backorders}
            loading={loading}
            onNotify={(backorder) => {
              setSelectedBackorder(backorder);
              setNotifyDialogOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="allocated" className="mt-6">
          <BackordersList
            backorders={backorders}
            loading={loading}
            onNotify={(backorder) => {
              setSelectedBackorder(backorder);
              setNotifyDialogOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <BackordersList
            backorders={backorders}
            loading={loading}
            onNotify={(backorder) => {
              setSelectedBackorder(backorder);
              setNotifyDialogOpen(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Notify Customer Dialog */}
      <AlertDialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notify Customer</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedBackorder && (
                <>
                  Send an ETA update email to <strong>{selectedBackorder.customer?.name}</strong>?
                  <br />
                  <br />
                  {selectedBackorder.expected_availability_date ? (
                    <span>
                      Expected availability: <strong>{format(new Date(selectedBackorder.expected_availability_date), "PPP")}</strong>
                    </span>
                  ) : (
                    <span className="text-warning">No ETA available. Please update before notifying.</span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleNotifyCustomer}
              disabled={processing || !selectedBackorder?.expected_availability_date}
              className="bg-brand-primary-600 hover:bg-brand-primary-700"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface BackordersListProps {
  backorders: Backorder[];
  loading: boolean;
  onNotify: (backorder: Backorder) => void;
}

function BackordersList({ backorders, loading, onNotify }: BackordersListProps) {
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

  if (backorders.length === 0) {
    return (
      <Card variant="elevated">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-brand-primary-100 p-4 mb-4 dark:bg-brand-primary-950">
            <CheckCircle className="h-10 w-10 text-brand-primary-600 dark:text-brand-primary-400" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            No backorders found
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Great! All orders are fulfilled or there are no pending backorders to display.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {backorders.map((backorder) => {
        const statusInfo = statusConfig[backorder.status as keyof typeof statusConfig] || statusConfig.pending;
        const StatusIcon = statusInfo.icon;
        const priorityColor = backorder.priority > 5 ? "text-error" : backorder.priority > 2 ? "text-warning" : "text-muted-foreground";

        return (
          <Card
            key={backorder.id}
            variant="elevated"
            className={cn(
              "transition-all hover:shadow-lg",
              backorder.is_overdue && "border-l-4 border-l-warning/50 bg-warning/5",
              backorder.priority > 5 && !backorder.is_overdue && "border-l-4 border-l-error/50"
            )}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn(
                    "rounded-lg p-2 mt-1",
                    backorder.status === "fulfilled" || backorder.status === "ready" ? "bg-success/10" :
                    backorder.status === "allocated" ? "bg-info/10" :
                    backorder.is_overdue ? "bg-warning/10" :
                    "bg-muted"
                  )}>
                    <StatusIcon className={cn(
                      "h-5 w-5",
                      statusInfo.color
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">
                        {backorder.product?.name || "Unknown Product"}
                      </CardTitle>
                      {backorder.priority > 2 && (
                        <Badge variant="outline" className={cn("capitalize", priorityColor)}>
                          Priority: {backorder.priority}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      SKU: {backorder.product?.sku || "N/A"} • Order: {backorder.order_id.slice(0, 8)}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={statusInfo.variant} icon={StatusIcon}>
                    {statusInfo.label}
                  </Badge>
                  {backorder.is_overdue && (
                    <Badge variant="pending" icon={AlertCircle}>
                      Overdue
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Customer Information */}
              {backorder.customer && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium text-foreground">{backorder.customer.name}</span>
                  {backorder.customer_notified && backorder.notification_count > 0 && (
                    <Badge variant="outline" className="ml-2">
                      <Bell className="mr-1 h-3 w-3" />
                      Notified {backorder.notification_count}x
                    </Badge>
                  )}
                </div>
              )}

              {/* Quantity Information */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Backordered:</span>
                  <span className="font-medium text-foreground">
                    {backorder.quantity_backordered} units
                  </span>
                </div>
                {backorder.quantity_fulfilled > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-success font-medium">
                      {backorder.quantity_fulfilled} fulfilled
                    </span>
                  </div>
                )}
              </div>

              {/* Remaining Quantity */}
              {backorder.quantity_remaining > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-warning" />
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-medium text-warning">
                    {backorder.quantity_remaining} units
                  </span>
                </div>
              )}

              {/* ETA Information */}
              {backorder.expected_availability_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Expected:</span>
                  <span className={cn(
                    "font-medium",
                    backorder.is_overdue ? "text-warning" : "text-foreground"
                  )}>
                    {format(new Date(backorder.expected_availability_date), "PPP")}
                  </span>
                  {backorder.days_until_available !== null && backorder.days_until_available >= 0 && (
                    <Badge variant="outline" className="ml-2">
                      {backorder.days_until_available} {backorder.days_until_available === 1 ? "day" : "days"}
                    </Badge>
                  )}
                </div>
              )}

              {/* Container Allocation */}
              {backorder.container && (
                <div className="flex items-center gap-2 text-sm">
                  <Ship className="h-4 w-4 text-info" />
                  <span className="text-muted-foreground">Allocated to:</span>
                  <span className="font-medium text-info">
                    {backorder.container.container_number}
                  </span>
                  {backorder.container.estimated_arrival_date && (
                    <span className="text-muted-foreground">
                      • ETA {format(new Date(backorder.container.estimated_arrival_date), "MMM d")}
                    </span>
                  )}
                </div>
              )}

              {/* Days Outstanding */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                <Clock className="h-4 w-4" />
                <span>Outstanding for {backorder.days_outstanding} {backorder.days_outstanding === 1 ? "day" : "days"}</span>
                <span>•</span>
                <span className="capitalize">{backorder.fulfillment_location}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/orders/${backorder.order_id}`)}
                >
                  <Eye className="mr-2 h-3 w-3" />
                  View Order
                </Button>
                {backorder.customer && backorder.status !== "fulfilled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNotify(backorder)}
                  >
                    <Bell className="mr-2 h-3 w-3" />
                    Notify Customer
                  </Button>
                )}
                {backorder.container_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/containers/${backorder.container_id}`)}
                  >
                    <Ship className="mr-2 h-3 w-3" />
                    View Container
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
