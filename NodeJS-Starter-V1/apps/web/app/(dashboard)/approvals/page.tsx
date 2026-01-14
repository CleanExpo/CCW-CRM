"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText, Package, TrendingUp, ShoppingCart, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ApprovalData {
  id: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  approval_type: string;
  approval_data: Record<string, any>;
  confirmation_token: string;
  created_at: string;
}

interface ApprovalList {
  items: ApprovalData[];
  total: number;
}

const severityConfig = {
  critical: {
    variant: "destructive" as const,
    icon: AlertTriangle,
    label: "Critical",
    color: "text-error",
  },
  high: {
    variant: "pending" as const,
    icon: AlertTriangle,
    label: "High Priority",
    color: "text-warning",
  },
  medium: {
    variant: "processing" as const,
    icon: Clock,
    label: "Medium",
    color: "text-info",
  },
  low: {
    variant: "secondary" as const,
    icon: Clock,
    label: "Low Priority",
    color: "text-muted-foreground",
  },
};

const approvalTypeIcons = {
  order_approval: ShoppingCart,
  stock_transfer: Package,
  procurement: TrendingUp,
  default: FileText,
};

export default function ApprovalsPage() {
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<ApprovalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalData | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  async function loadApprovals() {
    setLoading(true);
    try {
      const response = await apiClient.get<ApprovalList>("/api/approvals/pending");
      setApprovals(response.items);
    } catch (error: any) {
      console.error("Failed to load approvals:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load pending approvals",
      });
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadApprovals, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleApproveClick = (approval: ApprovalData) => {
    setSelectedApproval(approval);
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (approval: ApprovalData) => {
    setSelectedApproval(approval);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedApproval) return;

    setProcessing(true);
    try {
      await apiClient.post(`/api/approvals/${selectedApproval.id}/approve`, {
        confirmation_token: selectedApproval.confirmation_token,
        notes: null,
      });

      toast({
        title: "Approved",
        description: `${selectedApproval.title} has been approved successfully.`,
      });

      setApproveDialogOpen(false);
      setSelectedApproval(null);
      loadApprovals();
    } catch (error: any) {
      console.error("Failed to approve:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to approve action",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval || !rejectReason.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please provide a reason for rejection",
      });
      return;
    }

    setProcessing(true);
    try {
      await apiClient.post(`/api/approvals/${selectedApproval.id}/reject`, {
        reason: rejectReason,
      });

      toast({
        title: "Rejected",
        description: `${selectedApproval.title} has been rejected.`,
      });

      setRejectDialogOpen(false);
      setSelectedApproval(null);
      setRejectReason("");
      loadApprovals();
    } catch (error: any) {
      console.error("Failed to reject:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to reject action",
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatApprovalData = (data: Record<string, any>) => {
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Approvals
          </h1>
          <p className="text-muted-foreground">
            {approvals.length === 0
              ? "No pending approvals"
              : `${approvals.length} ${approvals.length === 1 ? "approval" : "approvals"} requiring your attention`}
          </p>
        </div>
        <Button variant="outline" onClick={loadApprovals} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Clock className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <Card variant="elevated">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-brand-primary-100 p-4 mb-4 dark:bg-brand-primary-950">
              <CheckCircle className="h-10 w-10 text-brand-primary-600 dark:text-brand-primary-400" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              All caught up!
            </p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              There are no pending approvals at this time. Autonomous agents are working smoothly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {approvals.map((approval) => {
            const severityInfo = severityConfig[approval.severity];
            const SeverityIcon = severityInfo.icon;
            const ApprovalIcon = approvalTypeIcons[approval.approval_type as keyof typeof approvalTypeIcons] || approvalTypeIcons.default;

            return (
              <Card key={approval.id} variant="elevated" className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-lg bg-brand-primary-100 p-2 dark:bg-brand-primary-950">
                          <ApprovalIcon className="h-5 w-5 text-brand-primary-600 dark:text-brand-primary-400" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-xl">{approval.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {format(new Date(approval.created_at), "PPpp")}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge variant={severityInfo.variant} icon={SeverityIcon}>
                        {severityInfo.label}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {approval.approval_type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {approval.message}
                    </p>
                  </div>

                  {approval.entity_type && (
                    <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span className="font-medium">Related Entity</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-foreground">Type:</span>{" "}
                        <span className="text-muted-foreground capitalize">{approval.entity_type}</span>
                      </div>
                      {approval.entity_id && (
                        <div className="text-xs font-mono text-muted-foreground break-all">
                          ID: {approval.entity_id}
                        </div>
                      )}
                    </div>
                  )}

                  {Object.keys(approval.approval_data).length > 0 && (
                    <div className="rounded-lg border border-border/50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Package className="h-3 w-3" />
                        <span className="font-medium">Approval Details</span>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(approval.approval_data).map(([key, value]) => (
                          <div key={key} className="text-sm flex items-start gap-2">
                            <span className="font-medium text-foreground capitalize min-w-24">
                              {key.replace(/_/g, " ")}:
                            </span>
                            <span className="text-muted-foreground break-all flex-1">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex gap-3 bg-muted/30 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleRejectClick(approval)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    variant="gradient"
                    className="flex-1 shadow-md hover:shadow-lg"
                    onClick={() => handleApproveClick(approval)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Approval</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedApproval && (
                <>
                  Are you sure you want to approve <strong>{selectedApproval.title}</strong>?
                  <br />
                  <br />
                  This action will allow the system to proceed with the requested operation.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={processing}
              className="bg-success hover:bg-success/90"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Rejection</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedApproval && (
                <>
                  You are about to reject <strong>{selectedApproval.title}</strong>.
                  <br />
                  Please provide a reason for this rejection.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="reject-reason">Rejection Reason *</Label>
            <Textarea
              id="reject-reason"
              placeholder="Explain why this action is being rejected..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={processing || !rejectReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
