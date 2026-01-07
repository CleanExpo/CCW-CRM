"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  order_number: string;
  status: string;
}

interface DeleteOrderDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteOrderDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: DeleteOrderDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const canDelete = order?.status === "draft" || order?.status === "cancelled";

  async function handleDelete() {
    if (!order || !canDelete) return;

    setIsLoading(true);

    try {
      await apiClient.delete(`/api/orders/${order.id}`);
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete order",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Order</DialogTitle>
          <DialogDescription>
            {canDelete ? (
              <>
                Are you sure you want to delete order <strong>{order?.order_number}</strong>? This
                action cannot be undone.
              </>
            ) : (
              <>
                Cannot delete order <strong>{order?.order_number}</strong> because it is in{" "}
                <strong>{order?.status}</strong> status. Only draft or cancelled orders can be
                deleted.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {canDelete ? "Cancel" : "Close"}
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
