"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  FormDescription,
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { inventoryApi } from "@/lib/api/inventory";
import type { StoreLocation } from "@/lib/types/inventory";

const reservationSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  order_id: z.string().min(1, "Order ID is required"),
  location: z.enum(["brisbane", "sydney", "melbourne"], {
    required_error: "Location is required",
  }),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  expires_in_hours: z.coerce
    .number()
    .min(1, "Expiration must be at least 1 hour")
    .max(72, "Expiration cannot exceed 72 hours")
    .optional(),
});

type ReservationFormData = z.infer<typeof reservationSchema>;

interface StockReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string;
  productName?: string;
  productSku?: string;
  onSuccess?: () => void;
}

export function StockReservationDialog({
  open,
  onOpenChange,
  productId,
  productName,
  productSku,
  onSuccess,
}: StockReservationDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      product_id: productId || "",
      order_id: "",
      location: "brisbane",
      quantity: 1,
      expires_in_hours: 24,
    },
  });

  // Update product_id when prop changes
  if (productId && form.getValues("product_id") !== productId) {
    form.setValue("product_id", productId);
  }

  async function onSubmit(values: ReservationFormData) {
    setIsLoading(true);
    try {
      const expires_at = values.expires_in_hours
        ? new Date(Date.now() + values.expires_in_hours * 60 * 60 * 1000).toISOString()
        : undefined;

      await inventoryApi.reserveStock({
        product_id: values.product_id,
        order_id: values.order_id,
        location: values.location as StoreLocation,
        quantity: values.quantity,
        expires_at,
      });

      toast({
        title: "Success",
        description: `Reserved ${values.quantity} units successfully`,
      });

      form.reset();
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reserve stock";
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reserve Stock</DialogTitle>
          <DialogDescription>
            {productName && productSku ? (
              <span>
                Reserve stock for{" "}
                <span className="font-semibold">
                  {productName} ({productSku})
                </span>
              </span>
            ) : (
              "Reserve stock for an order"
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Product ID (hidden if pre-selected) */}
            {!productId && (
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product ID" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Order ID */}
            <FormField
              control={form.control}
              name="order_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order ID *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter order ID" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormDescription>
                    The order this reservation is for
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="brisbane">Brisbane</SelectItem>
                      <SelectItem value="sydney">Sydney</SelectItem>
                      <SelectItem value="melbourne">Melbourne</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Where to reserve the stock from
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Enter quantity"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Number of units to reserve
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Expires in hours */}
            <FormField
              control={form.control}
              name="expires_in_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expires In (Hours)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="72"
                      placeholder="24"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Reservation will auto-release after this time (1-72 hours)
                  </FormDescription>
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
                {isLoading ? "Reserving..." : "Reserve Stock"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
