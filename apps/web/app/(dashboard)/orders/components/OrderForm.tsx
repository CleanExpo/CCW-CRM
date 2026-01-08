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
  status: z.string().min(1, "Status is required"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface OrderFormProps {
  order?: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function OrderForm({ order, open, onOpenChange, onSuccess }: OrderFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemErrors, setLineItemErrors] = useState<string[]>([]);
  const { toast } = useToast();
  const isEdit = !!order;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: "",
      status: "draft",
      notes: "",
    },
  });

  // Load customers
  useEffect(() => {
    async function loadCustomers() {
      try {
        const response = await apiClient.get<any>("/api/customers?page=1&page_size=100");
        setCustomers(response.items || []);
      } catch (error) {
        console.error("Failed to load customers:", error);
      }
    }
    loadCustomers();
  }, []);

  // Reset form when order changes or dialog opens
  useEffect(() => {
    if (order) {
      form.reset({
        customer_id: order.customer_id,
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
      form.reset({
        customer_id: "",
        status: "draft",
        notes: "",
      });
      setLineItems([]);
    }
    setLineItemErrors([]);
  }, [order, form, open]);

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Order" : "Create Order"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the order information and line items below."
              : "Fill in the order details and add line items to create a new order."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
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
                {isLoading ? "Saving..." : isEdit ? "Update Order" : "Create Order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
