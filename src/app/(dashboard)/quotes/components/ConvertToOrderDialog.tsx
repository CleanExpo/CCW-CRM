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
import { Quote } from "../types";

interface ConvertToOrderDialogProps{
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ConvertToOrderResponse {
  order_number: string;
}

export function ConvertToOrderDialog({
  quote,
  open,
  onOpenChange,
  onSuccess,
}: ConvertToOrderDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const canConvert = quote?.status.toLowerCase() === "accepted";

  async function handleConvert() {
    if (!quote || !canConvert) return;

    setIsLoading(true);

    try {
      const response = await apiClient.post<ConvertToOrderResponse>(
        `/api/quotes/${quote.id}/convert-to-order`,
        {}
      );

      toast({
        title: "Success",
        description: `Quote converted to order successfully. Order number: ${response.order_number}`,
      });

      onOpenChange(false);
      onSuccess();

      // Optional: Navigate to orders page
      // router.push("/orders");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to convert quote to order";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert Quote to Order</DialogTitle>
          <DialogDescription>
            {canConvert ? (
              <>
                Are you sure you want to convert quote{" "}
                <strong>{quote?.quote_number}</strong> for{" "}
                <strong>{quote?.customer_name}</strong> (${quote?.total}) to an
                order? This will create a new sales order with the same line
                items and mark the quote as converted.
              </>
            ) : (
              <>
                Cannot convert quote <strong>{quote?.quote_number}</strong>{" "}
                because it is in <strong>{quote?.status}</strong> status. Only
                accepted quotes can be converted to orders.
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
            {canConvert ? "Cancel" : "Close"}
          </Button>
          {canConvert && (
            <Button type="button" onClick={handleConvert} disabled={isLoading}>
              {isLoading ? "Converting..." : "Convert to Order"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
