"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  from_location: z.string().min(1, "Source location is required"),
  to_location: z.string().min(1, "Destination location is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => data.from_location !== data.to_location, {
  message: "Source and destination must be different",
  path: ["to_location"],
});

type FormData = z.infer<typeof formSchema>;

interface StockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productSku: string;
  onSuccess?: () => void;
}

export function StockTransferDialog({
  open,
  onOpenChange,
  productId,
  productName,
  productSku,
  onSuccess,
}: StockTransferDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      from_location: "",
      to_location: "",
      quantity: 1,
      reason: "",
      notes: "",
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      await apiClient.post("/api/inventory/transfer", {
        product_id: productId,
        from_location: values.from_location,
        to_location: values.to_location,
        quantity: values.quantity,
        reason: values.reason,
        notes: values.notes,
      });

      toast({
        title: "Stock Transfer Complete",
        description: `Transferred ${values.quantity} units from ${values.from_location} to ${values.to_location}`,
      });

      onSuccess?.();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: error.message || "Failed to transfer stock. Please check availability and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transfer Stock</DialogTitle>
          <DialogDescription>
            Move stock for <span className="font-semibold">{productName}</span> ({productSku}) between locations
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="from_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="brisbane">Brisbane</SelectItem>
                      <SelectItem value="sydney">Sydney</SelectItem>
                      <SelectItem value="melbourne">Melbourne</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="brisbane">Brisbane</SelectItem>
                      <SelectItem value="sydney">Sydney</SelectItem>
                      <SelectItem value="melbourne">Melbourne</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Enter quantity to transfer"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Stock rebalancing, High demand"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this transfer"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Transfer Stock
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
