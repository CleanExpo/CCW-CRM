"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api/client";
import type { PurchaseOrder } from "../types";

interface ReceiveGoodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder;
}

interface ReceiveInput {
  itemId: string;
  quantity: number;
}

export function ReceiveGoodsDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: ReceiveGoodsDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [receiveInputs, setReceiveInputs] = useState<ReceiveInput[]>([]);

  const handleQuantityChange = (itemId: string, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    setReceiveInputs((prev) => {
      const existing = prev.find((input) => input.itemId === itemId);
      if (existing) {
        return prev.map((input) =>
          input.itemId === itemId ? { ...input, quantity: qty } : input
        );
      } else {
        return [...prev, { itemId, quantity: qty }];
      }
    });
  };

  const getReceiveQuantity = (itemId: string): number => {
    return receiveInputs.find((input) => input.itemId === itemId)?.quantity || 0;
  };

  async function handleReceiveGoods() {
    // Validate at least one item to receive
    const itemsToReceive = receiveInputs.filter((input) => input.quantity > 0);

    if (itemsToReceive.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one quantity to receive",
        variant: "destructive",
      });
      return;
    }

    // Validate quantities don't exceed remaining
    const invalidItems = itemsToReceive.filter((input) => {
      const item = purchaseOrder.items.find((i) => i.id === input.itemId);
      if (!item) return true;
      const remaining = item.quantity - item.quantity_received;
      return input.quantity > remaining;
    });

    if (invalidItems.length > 0) {
      toast({
        title: "Error",
        description: "Some quantities exceed the remaining amount to receive",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Receive each item
      for (const input of itemsToReceive) {
        await apiClient.post(
          `/api/purchase-orders/${purchaseOrder.id}/items/${input.itemId}/receive`,
          { quantity_received: input.quantity }
        );
      }

      toast({
        title: "Success",
        description: `Received ${itemsToReceive.length} item(s) successfully`,
      });

      onOpenChange(false);
      router.refresh();
    } catch (error: any) {
      console.error("Failed to receive goods:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to receive goods",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Goods</DialogTitle>
          <DialogDescription>
            Enter the quantity received for each item. Stock levels will be updated
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="text-sm font-medium">PO: {purchaseOrder.po_number}</div>
            <div className="text-sm text-muted-foreground">
              Supplier: {purchaseOrder.supplier_name}
            </div>
          </div>

          {purchaseOrder.items.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No items in this purchase order
            </div>
          ) : (
            <div className="space-y-3">
              {purchaseOrder.items.map((item) => {
                const remaining = item.quantity - item.quantity_received;
                const receiveQty = getReceiveQuantity(item.id!);

                return (
                  <div
                    key={item.id}
                    className="rounded-md border p-4 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{item.product_name}</div>
                        {item.product_sku && (
                          <div className="text-sm text-muted-foreground">
                            SKU: {item.product_sku}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-right">
                        <div className="font-medium">
                          ${item.unit_cost.toFixed(2)} / unit
                        </div>
                        <div className="text-muted-foreground">
                          Subtotal: ${item.subtotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Ordered</div>
                        <div className="font-medium">{item.quantity} units</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Already Received</div>
                        <div className="font-medium">
                          {item.quantity_received} units
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Remaining</div>
                        <div className="font-medium text-blue-600">
                          {remaining} units
                        </div>
                      </div>
                    </div>

                    {remaining > 0 && (
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Quantity to Receive Now
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max={remaining}
                          value={receiveQty}
                          onChange={(e) =>
                            handleQuantityChange(item.id!, e.target.value)
                          }
                          placeholder="0"
                          disabled={isLoading}
                        />
                      </div>
                    )}

                    {remaining === 0 && (
                      <div className="text-sm text-green-600 font-medium">
                        ✓ Fully received
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReceiveGoods}
              disabled={isLoading || purchaseOrder.items.length === 0}
            >
              {isLoading ? "Receiving..." : "Receive Goods"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
