/**
 * Bulk Status Toggle Dialog
 *
 * Allows activating or deactivating multiple products at once.
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

interface BulkStatusToggleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProductIds: string[];
  onSuccess: () => void;
}

export function BulkStatusToggleDialog({
  open,
  onOpenChange,
  selectedProductIds,
  onSuccess,
}: BulkStatusToggleDialogProps) {
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

    const isActive = status === "active";

    setIsUpdating(true);
    try {
      // Update each product individually
      let successCount = 0;
      let errorCount = 0;

      for (const productId of selectedProductIds) {
        try {
          await apiClient.put(`/api/products/${productId}`, {
            is_active: isActive,
          });
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to update product ${productId}:`, error);
        }
      }

      toast({
        title: "Status Updated",
        description: `Successfully updated ${successCount} product(s)${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
      });

      onSuccess();
      onOpenChange(false);
      setStatus("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update product statuses",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Product Status</DialogTitle>
          <DialogDescription>
            Update the status of {selectedProductIds.length} selected product(s)
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              This will {status === "active" ? "activate" : "deactivate"} all selected products.
              {status === "inactive" && " Inactive products will not appear in orders."}
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
            Update {selectedProductIds.length} Product(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
