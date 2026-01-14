"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  TrendingDown,
  Package,
  ShoppingCart,
  GitBranch,
  Loader2,
  Bell,
  BellOff,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "unread" | "read" | "dismissed" | "actioned";
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  assigned_to: string | null;
  metadata: Record<string, any>;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  actioned_at: string | null;
}

interface AlertsResponse {
  items: Alert[];
  total: number;
}

const severityConfig = {
  critical: {
    variant: "destructive" as const,
    icon: AlertTriangle,
    label: "Critical",
    color: "border-error/50 bg-error/5",
  },
  high: {
    variant: "pending" as const,
    icon: AlertCircle,
    label: "High",
    color: "border-warning/50 bg-warning/5",
  },
  medium: {
    variant: "processing" as const,
    icon: Info,
    label: "Medium",
    color: "border-info/50 bg-info/5",
  },
  low: {
    variant: "secondary" as const,
    icon: Clock,
    label: "Low",
    color: "border-muted-foreground/20 bg-muted/30",
  },
};

const alertTypeIcons: Record<string, any> = {
  stock_low: TrendingDown,
  approval_required: CheckCircle,
  integration_error: GitBranch,
  container_arrival: Package,
  order_high_value: ShoppingCart,
  default: Bell,
};

export default function AlertsPage() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"unread" | "all">("unread");

  async function loadAlerts() {
    setLoading(true);
    try {
      // TODO: Replace with actual API endpoint once backend is ready
      // const response = await apiClient.get<AlertsResponse>("/api/alerts");
      // setAlerts(response.items);

      // Placeholder data for UI demonstration
      setAlerts([]);
    } catch (error: any) {
      console.error("Failed to load alerts:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load alerts",
      });
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (alertId: string) => {
    try {
      // TODO: Implement once API is ready
      // await apiClient.post(`/api/alerts/${alertId}/read`);
      toast({
        title: "Marked as Read",
        description: "Alert has been marked as read.",
      });
      loadAlerts();
    } catch (error: any) {
      console.error("Failed to mark as read:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to mark alert as read",
      });
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      // TODO: Implement once API is ready
      // await apiClient.post(`/api/alerts/${alertId}/dismiss`);
      toast({
        title: "Dismissed",
        description: "Alert has been dismissed.",
      });
      loadAlerts();
    } catch (error: any) {
      console.error("Failed to dismiss alert:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to dismiss alert",
      });
    }
  };

  const filteredAlerts =
    activeTab === "unread"
      ? alerts.filter((a) => a.status === "unread")
      : alerts;

  const unreadCount = alerts.filter((a) => a.status === "unread").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Alerts
          </h1>
          <p className="text-muted-foreground">
            {unreadCount === 0
              ? "No unread alerts"
              : `${unreadCount} unread ${unreadCount === 1 ? "alert" : "alerts"}`}
          </p>
        </div>
        <Button variant="outline" onClick={loadAlerts} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Clock className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "unread" | "all")} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="unread" className="relative">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="mt-6">
          <AlertsList
            alerts={filteredAlerts}
            loading={loading}
            onMarkAsRead={handleMarkAsRead}
            onDismiss={handleDismiss}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <AlertsList
            alerts={filteredAlerts}
            loading={loading}
            onMarkAsRead={handleMarkAsRead}
            onDismiss={handleDismiss}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AlertsListProps {
  alerts: Alert[];
  loading: boolean;
  onMarkAsRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
}

function AlertsList({ alerts, loading, onMarkAsRead, onDismiss }: AlertsListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card variant="elevated">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-brand-primary-100 p-4 mb-4 dark:bg-brand-primary-950">
            <BellOff className="h-10 w-10 text-brand-primary-600 dark:text-brand-primary-400" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            No alerts
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            You're all caught up! There are no alerts to display at this time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => {
        const severityInfo = severityConfig[alert.severity];
        const SeverityIcon = severityInfo.icon;
        const AlertIcon = alertTypeIcons[alert.alert_type] || alertTypeIcons.default;
        const isUnread = alert.status === "unread";

        return (
          <Card
            key={alert.id}
            variant="elevated"
            className={cn(
              "transition-all hover:shadow-lg border-l-4",
              severityInfo.color,
              isUnread && "ring-2 ring-brand-primary-200 dark:ring-brand-primary-800"
            )}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn(
                    "rounded-lg p-2 mt-1",
                    alert.severity === "critical" ? "bg-error/10" :
                    alert.severity === "high" ? "bg-warning/10" :
                    alert.severity === "medium" ? "bg-info/10" :
                    "bg-muted"
                  )}>
                    <AlertIcon className={cn(
                      "h-5 w-5",
                      alert.severity === "critical" ? "text-error" :
                      alert.severity === "high" ? "text-warning" :
                      alert.severity === "medium" ? "text-info" :
                      "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base">{alert.title}</CardTitle>
                      {isUnread && (
                        <Badge variant="default" className="text-xs">New</Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      {alert.message}
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(alert.created_at), "PPp")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={severityInfo.variant} icon={SeverityIcon} className="shrink-0">
                    {severityInfo.label}
                  </Badge>
                  {alert.alert_type && (
                    <Badge variant="outline" className="capitalize text-xs shrink-0">
                      {alert.alert_type.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                {isUnread && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMarkAsRead(alert.id)}
                  >
                    <Eye className="mr-2 h-3 w-3" />
                    Mark as Read
                  </Button>
                )}
                {alert.status !== "dismissed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDismiss(alert.id)}
                  >
                    <EyeOff className="mr-2 h-3 w-3" />
                    Dismiss
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
