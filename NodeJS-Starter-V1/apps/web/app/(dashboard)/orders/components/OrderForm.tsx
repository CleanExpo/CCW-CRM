"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { OrderLineItems, LineItem } from "./OrderLineItems";
import { Order, Customer } from "../types";
import { Plus } from "lucide-react";

const ORDER_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const formSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  fulfillment_location: z.string().min(1, "Fulfillment location is required"),
  status: z.string().min(1, "Status is required"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface OrderFormProps {
  order?: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onQuickAddClick?: () => void;
  selectedCustomerId?: string;
}

export function OrderForm({ order, open, onOpenChange, onSuccess, onQuickAddClick, selectedCustomerId }: OrderFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemErrors, setLineItemErrors] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("brisbane");
  const { toast, dismissAll } = useToast();
  const isEdit = !!order;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: "",
      fulfillment_location: "brisbane",
      status: "draft",
      notes: "",
    },
  });

  // Load customers
  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const response = await apiClient.get<any>("/api/customers?page=1&page_size=100");
      setCustomers(response.items || []);
    } catch (error) {
      console.error("Failed to load customers:", error);
    }
  }

  // Auto-select customer if passed from parent (QuickAdd)
  useEffect(() => {
    if (selectedCustomerId && open) {
      form.setValue("customer_id", selectedCustomerId);
    }
  }, [selectedCustomerId, open, form]);

  // Reset form when order changes or dialog opens
  useEffect(() => {
    if (order) {
      const location = (order as any).fulfillment_location || "brisbane";
      setSelectedLocation(location);
      form.reset({
        customer_id: order.customer_id,
        fulfillment_location: location,
        status: order.status,
        notes: order.notes || "",
      });
      // Convert API strings to numbers for line items
      const items = (order.items || order.order_items || []).map((item: any) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        line_total: Number(item.line_total),
      }));

      setLineItems(items);
    } else {
      setSelectedLocation("brisbane");
      form.reset({
        customer_id: "",
        fulfillment_location: "brisbane",
        status: "draft",
        notes: "",
      });
      setLineItems([]);
    }
    setLineItemErrors([]);
  }, [order, form, open]);

  // Clear error toasts when dialog closes
  useEffect(() => {
    if (!open) {
      dismissAll();
    }
  }, [open, dismissAll]);

  async function onSubmit(values: FormData) {
    // Validate line items
    const errors: string[] = [];

    if (lineItems.length === 0) {
      errors.push("At least one line item is required");
    }

    lineItems.forEach((item, index) => {
      if (!item.product_id) {
        errors.push(`Item ${index + 1}: Product is required`);
      }
      if (item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
      }
    });

    if (errors.length > 0) {
      setLineItemErrors(errors);
      return;
    }

    setIsLoading(true);
    setLineItemErrors([]);

    try {
      const payload = {
        customer_id: values.customer_id,
        fulfillment_location: values.fulfillment_location,
        status: values.status,
        notes: values.notes || null,
        items: lineItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      };

      if (isEdit && order) {
        await apiClient.put(`/api/orders/${order.id}`, payload);
        toast({
          title: "Success",
          description: "Order updated successfully",
        });
      } else {
        await apiClient.post("/api/orders", payload);
        toast({
          title: "Success",
          description: "Order created successfully",
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${isEdit ? "update" : "create"} order`,
      });
    } finally {
      setIsLoading(false);
    }
  }

  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Order" : "Create Order"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the order information and line items below."
              : "Fill in the order details and add line items to create a new order."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <Form {...form}>
          <form id="order-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Fulfillment Location Selection */}
            <FormField
              control={form.control}
              name="fulfillment_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fulfillment Location</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedLocation(value);
                    }}
                    value={field.value}
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel>Customer</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onQuickAddClick?.()}
                        className="h-6 px-2"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Quick Add
                      </Button>
                    </div>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.customer_number} - {customer.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        {ORDER_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Order notes or special instructions..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <OrderLineItems
              items={lineItems}
              onChange={setLineItems}
              errors={lineItemErrors}
              selectedLocation={selectedLocation}
            />

            {lineItems.length > 0 && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (10% GST):</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Form>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" form="order-form" disabled={isLoading}>
            {isLoading ? "Saving..." : isEdit ? "Update Order" : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
