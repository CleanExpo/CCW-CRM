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

interface DeleteQuoteDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteQuoteDialog({
  quote,
  open,
  onOpenChange,
  onSuccess,
}: DeleteQuoteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const canDelete = quote?.status === "draft";

  async function handleDelete() {
    if (!quote || !canDelete) return;

    setIsLoading(true);

    try {
      await apiClient.delete(`/api/quotes/${quote.id}`);
      toast({
        title: "Success",
        description: "Quote deleted successfully",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete quote",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Quote</DialogTitle>
          <DialogDescription>
            {canDelete ? (
              <>
                Are you sure you want to delete quote <strong>{quote?.quote_number}</strong>? This
                action cannot be undone.
              </>
            ) : (
              <>
                Cannot delete quote <strong>{quote?.quote_number}</strong> because it is in{" "}
                <strong>{quote?.status}</strong> status. Only draft quotes can be deleted.
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
