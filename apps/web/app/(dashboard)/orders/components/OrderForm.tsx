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
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { OrderLineItems, LineItem } from "./OrderLineItems";
import { QuickCustomerAdd } from "./QuickCustomerAdd";
import { Order, Customer, OrderItem } from "../types";
import { Plus } from "lucide-react";
// PHASE 4: Autosave + Recent Items imports
import { useAutosave } from "@/lib/hooks/use-autosave";
import { DraftRecoveryAlert } from "@/components/ui/draft-recovery-alert";
import { useRecentItems } from "@/lib/hooks/use-recent-items";

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
}

export function OrderForm({ order, open, onOpenChange, onSuccess }: OrderFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemErrors, setLineItemErrors] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("brisbane");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { toast } = useToast();
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

  // PHASE 4: Recent customers cache - speeds up order entry
  const { recentItems: recentCustomers, addRecentItem: addRecentCustomer } =
    useRecentItems<Customer>({
      key: "recent-customers",
      maxItems: 10,
    });

  // PHASE 4: Autosave hook - prevents data loss on dialog close/navigation
  const draftKey = isEdit ? `order-form-${order?.id}` : "order-form-new";
  const { hasDraft, draftMetadata, loadDraft, clearDraft } = useAutosave({
    key: draftKey,
    formValues: {
      ...form.watch(),
      lineItems, // Include line items in autosave
    },
    onRestore: (draft) => {
      // Restore form fields
      if (draft.customer_id) form.setValue("customer_id", draft.customer_id);
      if (draft.fulfillment_location) form.setValue("fulfillment_location", draft.fulfillment_location);
      if (draft.status) form.setValue("status", draft.status);
      if (draft.notes) form.setValue("notes", draft.notes);
      // Restore line items
      if (Array.isArray(draft.lineItems) && draft.lineItems.length > 0) {
        setLineItems(draft.lineItems);
      }
    },
    enabled: open && !isEdit, // Only autosave for new orders (not edits)
    debounceMs: 2000, // Save every 2 seconds
  });

  const loadCustomers = useCallback(async () => {
    try {
      const response = await apiClient.get<{ items: Customer[] }>(
        "/api/customers?page=1&page_size=100"
      );
      setCustomers(response.items || []);
    } catch (error) {
      console.error("Failed to load customers:", error);
    }
  }, []);

  // Load customers
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  function handleCustomerCreated(customer: { id: string; company_name: string }) {
    // Reload customers list
    loadCustomers();
    // Auto-select the newly created customer
    form.setValue("customer_id", customer.id);
    toast({
      title: "Customer Added",
      description: `${customer.company_name} has been selected for this order.`,
    });
  }

  // Reset form when order changes or dialog opens
  useEffect(() => {
    if (order) {
      const location = order.fulfillment_location || "brisbane";
      setSelectedLocation(location);
      form.reset({
        customer_id: order.customer_id,
        fulfillment_location: location,
        status: order.status,
        notes: order.notes || "",
      });
      // Convert API strings to numbers for line items
      const items = (order.items || order.order_items || [])
        .filter((item: OrderItem) => item.product_id) // Filter out items without product_id
        .map((item: OrderItem) => ({
          ...item,
          product_id: item.product_id!, // Assert product_id is present after filter
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          line_total: Number(item.line_total || 0),
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

      // PHASE 4: Clear draft on successful submission
      clearDraft();

      // PHASE 4: Add customer to recent items
      const selectedCustomer = customers.find((c) => c.id === values.customer_id);
      if (selectedCustomer) {
        addRecentCustomer(selectedCustomer);
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to ${isEdit ? "update" : "create"} order`;
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
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

        {/* PHASE 4: Draft Recovery Alert */}
        {hasDraft && !isEdit && draftMetadata && (
          <DraftRecoveryAlert
            savedAt={draftMetadata.savedAt}
            onRestore={loadDraft}
            onDiscard={clearDraft}
            message="You have unsaved order data. Would you like to restore it?"
          />
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        onClick={() => setQuickAddOpen(true)}
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
                        {/* PHASE 4: Show recent customers first */}
                        {recentCustomers.length > 0 && (
                          <>
                            {recentCustomers.map((customer) => (
                              <SelectItem key={`recent-${customer.id}`} value={customer.id}>
                                🕒 {customer.customer_number} - {customer.company_name}
                              </SelectItem>
                            ))}
                            <div className="border-t my-1" />
                          </>
                        )}
                        {customers
                          .filter(
                            (c) => !recentCustomers.some((recent) => recent.id === c.id)
                          )
                          .map((customer) => (
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

      {/* Quick Customer Add Dialog */}
      <QuickCustomerAdd
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onCustomerCreated={handleCustomerCreated}
      />
    </Dialog>
  );
}
