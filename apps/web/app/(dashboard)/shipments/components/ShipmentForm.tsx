"use client";

import { useState, useEffect, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import {
  shipmentsApi,
  type Shipment,
  type ShipmentCreate,
  type ShipmentUpdate,
  type ShipmentStatus,
} from "@/lib/api/shipments";
import { apiClient } from "@/lib/api/client";

interface Order {
  id: string;
  order_number: string;
  customer_name?: string;
  status: string;
}

// Validation schema
const formSchema = z.object({
  order_id: z.string().min(1, "Order is required"),
  carrier_name: z.string().min(1, "Carrier name is required"),
  tracking_number: z.string().min(1, "Tracking number is required"),
  shipping_method: z.string().optional(),
  shipped_date: z.string().optional(),
  estimated_delivery_date: z.string().optional(),
  actual_delivery_date: z.string().optional(),
  status: z.enum(["pending", "in_transit", "delivered", "cancelled", "returned"]).optional(),
  shipping_address: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_state: z.string().optional(),
  shipping_postcode: z.string().optional(),
  shipping_country: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ShipmentFormProps {
  shipment?: Shipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ShipmentForm({ shipment, open, onOpenChange, onSuccess }: ShipmentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();
  const isEdit = !!shipment;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      order_id: "",
      carrier_name: "",
      tracking_number: "",
      shipping_method: "",
      shipped_date: "",
      estimated_delivery_date: "",
      actual_delivery_date: "",
      status: "pending",
      shipping_address: "",
      shipping_city: "",
      shipping_state: "",
      shipping_postcode: "",
      shipping_country: "",
      notes: "",
    },
  });

  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      const response = await apiClient.get<{ items: Order[] }>(
        "/api/orders?page=1&page_size=100&status=confirmed"
      );
      setOrders(response.items || []);
    } catch (error) {
      console.error("Failed to load orders:", error);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadOrders();
    }
  }, [open, loadOrders]);

  // Reset form when dialog opens/closes or shipment changes
  useEffect(() => {
    if (open && shipment) {
      // Edit mode - populate form with shipment data
      form.reset({
        order_id: shipment.order_id,
        carrier_name: shipment.carrier_name,
        tracking_number: shipment.tracking_number,
        shipping_method: shipment.shipping_method || "",
        shipped_date: shipment.shipped_date?.split("T")[0] || "",
        estimated_delivery_date: shipment.estimated_delivery_date?.split("T")[0] || "",
        actual_delivery_date: shipment.actual_delivery_date?.split("T")[0] || "",
        status: shipment.status,
        shipping_address: shipment.shipping_address || "",
        shipping_city: shipment.shipping_city || "",
        shipping_state: shipment.shipping_state || "",
        shipping_postcode: shipment.shipping_postcode || "",
        shipping_country: shipment.shipping_country || "",
        notes: shipment.notes || "",
      });
    } else if (open && !shipment) {
      // Create mode - reset to defaults
      form.reset({
        order_id: "",
        carrier_name: "",
        tracking_number: "",
        shipping_method: "",
        shipped_date: new Date().toISOString().split("T")[0], // Default to today
        estimated_delivery_date: "",
        actual_delivery_date: "",
        status: "pending",
        shipping_address: "",
        shipping_city: "",
        shipping_state: "",
        shipping_postcode: "",
        shipping_country: "",
        notes: "",
      });
    }
  }, [open, shipment, form]);

  // Handle form submission
  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      if (isEdit && shipment) {
        // Update existing shipment
        const updateData: ShipmentUpdate = {
          carrier_name: values.carrier_name,
          tracking_number: values.tracking_number,
          shipping_method: values.shipping_method || undefined,
          shipped_date: values.shipped_date || undefined,
          estimated_delivery_date: values.estimated_delivery_date || undefined,
          actual_delivery_date: values.actual_delivery_date || undefined,
          status: values.status as ShipmentStatus,
          shipping_address: values.shipping_address || undefined,
          shipping_city: values.shipping_city || undefined,
          shipping_state: values.shipping_state || undefined,
          shipping_postcode: values.shipping_postcode || undefined,
          shipping_country: values.shipping_country || undefined,
          notes: values.notes || undefined,
        };

        await shipmentsApi.update(shipment.id, updateData);
        toast({
          title: "Success",
          description: "Shipment updated successfully",
        });
      } else {
        // Create new shipment
        const createData: ShipmentCreate = {
          order_id: values.order_id,
          carrier_name: values.carrier_name,
          tracking_number: values.tracking_number,
          shipping_method: values.shipping_method || undefined,
          shipped_date: values.shipped_date || undefined,
          estimated_delivery_date: values.estimated_delivery_date || undefined,
          shipping_address: values.shipping_address || undefined,
          shipping_city: values.shipping_city || undefined,
          shipping_state: values.shipping_state || undefined,
          shipping_postcode: values.shipping_postcode || undefined,
          shipping_country: values.shipping_country || undefined,
          notes: values.notes || undefined,
        };

        await shipmentsApi.create(createData);
        toast({
          title: "Success",
          description: "Shipment created successfully",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Operation failed";
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Update Shipment" : "Create New Shipment"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update shipment tracking and delivery information"
              : "Create a new shipment for an order"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Order Selection (Create Only) */}
            {!isEdit && (
              <FormField
                control={form.control}
                name="order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select order" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {orders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.order_number} {order.customer_name && `- ${order.customer_name}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Status (Edit Only) */}
            {isEdit && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_transit">In Transit</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Shipping Details */}
            <div className="grid grid-cols-2 gap-4">
              {/* Carrier Name */}
              <FormField
                control={form.control}
                name="carrier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., FedEx, UPS, DHL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tracking Number */}
              <FormField
                control={form.control}
                name="tracking_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tracking Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter tracking number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Shipping Method */}
              <FormField
                control={form.control}
                name="shipping_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Method</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Ground, Express, Air" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-4">
              {/* Shipped Date */}
              <FormField
                control={form.control}
                name="shipped_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipped Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estimated Delivery Date */}
              <FormField
                control={form.control}
                name="estimated_delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Est. Delivery Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actual Delivery Date (Edit Only) */}
              {isEdit && (
                <FormField
                  control={form.control}
                  name="actual_delivery_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Delivery Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Shipping Address Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Shipping Address (Optional)</h3>

              {/* Address */}
              <FormField
                control={form.control}
                name="shipping_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* City */}
                <FormField
                  control={form.control}
                  name="shipping_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* State */}
                <FormField
                  control={form.control}
                  name="shipping_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State/Province</FormLabel>
                      <FormControl>
                        <Input placeholder="State" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Postcode */}
                <FormField
                  control={form.control}
                  name="shipping_postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country */}
                <FormField
                  control={form.control}
                  name="shipping_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this shipment..."
                      rows={3}
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
                {isLoading ? "Saving..." : isEdit ? "Update Shipment" : "Create Shipment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
