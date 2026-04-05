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
import { invoicesApi } from "@/lib/api/invoices";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, InvoiceSummary } from "@/types/invoices";

interface DeleteInvoiceDialogProps {
  invoice: Invoice | InvoiceSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteInvoiceDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: DeleteInvoiceDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Only allow deletion of draft or cancelled invoices
  const canDelete = invoice?.status === "draft" || invoice?.status === "cancelled";

  async function handleDelete() {
    if (!invoice || !canDelete) return;

    setIsLoading(true);

    try {
      await invoicesApi.delete(invoice.id);
      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete invoice";
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
          <DialogTitle>Delete Invoice</DialogTitle>
          <DialogDescription>
            {canDelete ? (
              <>
                Are you sure you want to delete invoice <strong>{invoice?.invoice_number}</strong>?
                This action cannot be undone.
              </>
            ) : (
              <>
                Cannot delete invoice <strong>{invoice?.invoice_number}</strong> because it is in{" "}
                <strong>{invoice?.status}</strong> status. Only draft or cancelled invoices can be
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
