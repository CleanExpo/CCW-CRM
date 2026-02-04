"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { PendingMatchesTable } from "./PendingMatchesTable";

interface DashboardSummary {
  total_pending: number;
  total_matched: number;
  total_with_suggestions: number;
  auto_match_rate: number;
  pending_amount: number;
  matched_today: number;
  last_sync_at: string | null;
}

export function ReconciliationDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchSummary = async () => {
    try {
      const data = await apiClient.get<DashboardSummary>("/api/reconciliation/dashboard");
      setSummary(data);
    } catch (error: any) {
      toast({
        title: "Error loading dashboard",
        description: error.message || "Failed to load reconciliation summary",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSummary();
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading dashboard...</div>;
  }

  if (!summary) {
    return <div className="text-center py-8 text-muted-foreground">No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Feeds</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ${summary.pending_amount.toLocaleString()} unreconciled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Match Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary.auto_match_rate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.total_matched} matched overall
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Suggestions</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_with_suggestions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready for review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matched Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.matched_today}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.last_sync_at
                ? `Synced ${formatRelativeTime(summary.last_sync_at)}`
                : "Not synced yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {summary.total_pending} pending
          </Badge>
          {summary.total_with_suggestions > 0 && (
            <Badge variant="secondary" className="text-sm">
              {summary.total_with_suggestions} with AI suggestions
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Pending Matches Table */}
      <PendingMatchesTable onReconciled={fetchSummary} />
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
