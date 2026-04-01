/**
 * Bulk Status Update Dialog
 *
 * Allows updating the status of multiple orders at once.
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface BulkStatusUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOrderIds: string[];
  onSuccess: () => void;
}

const ORDER_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export function BulkStatusUpdateDialog({
  open,
  onOpenChange,
  selectedOrderIds,
  onSuccess,
}: BulkStatusUpdateDialogProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSubmit = async () => {
    if (!status) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a status",
      });
      return;
    }

    setIsUpdating(true);
    try {
      // Update each order individually
      let successCount = 0;
      let errorCount = 0;

      for (const orderId of selectedOrderIds) {
        try {
          await apiClient.put(`/api/orders/${orderId}/status`, {
            status,
          });
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to update order ${orderId}:`, error);
        }
      }

      toast({
        title: "Status Updated",
        description: `Successfully updated ${successCount} order(s)${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
      });

      onSuccess();
      onOpenChange(false);
      setStatus("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update order statuses",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
          <DialogDescription>
            Update the status of {selectedOrderIds.length} selected order(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">New Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((statusOption) => (
                  <SelectItem key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              This will update the status of all selected orders to{" "}
              <span className="font-semibold">{status || "the selected status"}</span>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdating || !status}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update {selectedOrderIds.length} Order(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
