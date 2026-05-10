'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldErrors } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { OrderLineItems, LineItem } from './OrderLineItems';
import { QuickCustomerAdd } from './QuickCustomerAdd';
import { Order, Customer, OrderItem } from '../types';
import { Plus } from 'lucide-react';
import { useRecentItems } from '@/hooks/use-recent-items';
// PHASE AI: Form Auto-Fill imports
import { useFormAutoFill } from '@/hooks/use-form-autofill';
import { ProductAutoFillSuggestion } from '@/components/forms/AutoFillSuggestion';
// PHASE AI: Anomaly Detection imports
import { AnomalyAlert } from '@/components/alerts/AnomalyAlert';

const ORDER_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const formSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  fulfillment_location: z.string().min(1, 'Fulfillment location is required'),
  status: z.string().min(1, 'Status is required'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

/** IDs for active workspace products (matches order POST validation). */
async function fetchWorkspaceActiveProductIdSet(): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  const pageSize = 500;
  let totalPages = 1;
  do {
    const res = await apiClient.get<{
      items: { id: string }[];
      total_pages: number;
    }>(`/api/products?page=${page}&page_size=${pageSize}`);
    for (const p of res.items ?? []) ids.add(p.id);
    totalPages = Math.max(1, res.total_pages ?? 1);
    page += 1;
  } while (page <= totalPages && page <= 40);
  return ids;
}

function flattenFormErrorMessages(errors: FieldErrors<FormData>): string[] {
  const messages: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.length > 0) {
      messages.push(o.message);
      return;
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === 'object') visit(v);
    }
  };
  visit(errors);
  return [...new Set(messages)];
}

interface OrderFormProps {
  order?: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `created` is true when a new order was persisted (not update/duplicate-save). */
  onSuccess: (meta?: { created?: boolean }) => void;
}

export function OrderForm({ order, open, onOpenChange, onSuccess }: OrderFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  /** True after a successful GET /api/customers for this dialog session (used to validate selection vs workspace). */
  const [customersHydrated, setCustomersHydrated] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemErrors, setLineItemErrors] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('brisbane');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [anomalyDetected, setAnomalyDetected] = useState<
    | {
        is_anomaly?: boolean;
        severity: string;
        description: string;
        recommended_action: string;
        confidence: number;
        details?: Record<string, unknown>;
      }
    | 'bypass'
    | null
  >(null);
  const [showAnomalyAlert, setShowAnomalyAlert] = useState(false);
  const { toast } = useToast();
  const isEdit = Boolean(order?.id);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: '',
      fulfillment_location: 'brisbane',
      status: 'draft',
      notes: '',
    },
  });

  // PHASE 4: Recent customers cache - speeds up order entry
  const {
    recentItems: recentCustomers,
    addRecentItem: addRecentCustomer,
    removeRecentItem: removeRecentCustomer,
  } = useRecentItems<Customer>({
    key: 'recent-customers',
    maxItems: 10,
  });

  /** Recent list is stored in localStorage and can contain IDs from another DB/session — only show IDs that exist in the workspace list. */
  const recentCustomersValid = useMemo(
    () => recentCustomers.filter((r) => customers.some((c) => c.id === r.id)),
    [recentCustomers, customers],
  );

  // PHASE AI: Form auto-fill suggestions based on customer history
  const selectedCustomerId = form.watch('customer_id');
  const {
    suggestions,
    confidence,
    source,
    loading: autoFillLoading,
    fetchSuggestions,
  } = useFormAutoFill({
    formType: 'order',
    customerId: selectedCustomerId || undefined,
    limit: 10,
  });

  // Fetch auto-fill suggestions when customer selected
  useEffect(() => {
    if (selectedCustomerId && !isEdit) {
      fetchSuggestions();
    }
  }, [selectedCustomerId, isEdit, fetchSuggestions]);

  const loadCustomers = useCallback(async () => {
    try {
      const response = await apiClient.get<{ items: Customer[] }>(
        '/api/customers?page=1&page_size=200'
      );
      setCustomers(response.items || []);
      setCustomersHydrated(true);
    } catch (error) {
      console.error('Failed to load customers:', error);
      setCustomersHydrated(false);
      const message =
        error instanceof ApiClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not load customers';
      toast({
        variant: 'destructive',
        title: 'Could not load customers',
        description: message,
      });
    }
  }, [toast]);

  // Load customers when the form opens so the list is fresh and errors surface in context
  useEffect(() => {
    if (!open) return;
    void loadCustomers();
  }, [open, loadCustomers]);

  useEffect(() => {
    if (!open) setCustomersHydrated(false);
  }, [open]);

  // Drop stale "recent" entries that are not in the current workspace customer list
  useEffect(() => {
    if (!customersHydrated) return;
    recentCustomers.forEach((r) => {
      if (!customers.some((c) => c.id === r.id)) {
        removeRecentCustomer(r);
      }
    });
  }, [customersHydrated, customers, recentCustomers, removeRecentCustomer]);

  // Draft/autosave or old browser storage may reference a customer_id that does not belong to this workspace
  useEffect(() => {
    if (!open || !customersHydrated || isEdit) return;
    const id = form.getValues('customer_id');
    if (!id) return;
    if (!customers.some((c) => c.id === id)) {
      form.setValue('customer_id', '');
    }
  }, [open, customersHydrated, isEdit, customers, form]);

  useEffect(() => {
    if (!open) return;
    setAnomalyDetected(null);
    setShowAnomalyAlert(false);
  }, [open, order?.id]);

  function handleCustomerCreated(customer: { id: string; company_name: string }) {
    // Reload customers list
    loadCustomers();
    // Auto-select the newly created customer
    form.setValue('customer_id', customer.id);
    toast({
      title: 'Customer Added',
      description: `${customer.company_name} has been selected for this order.`,
    });
  }

  // Reset form when order changes or dialog opens
  useEffect(() => {
    if (order) {
      const location = order.fulfillment_location || 'brisbane';
      setSelectedLocation(location);
      form.reset({
        customer_id: order.customer_id,
        fulfillment_location: location,
        status: order.status,
        notes: order.notes || '',
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
      setSelectedLocation('brisbane');
      form.reset({
        customer_id: '',
        fulfillment_location: 'brisbane',
        status: 'draft',
        notes: '',
      });
      setLineItems([]);
    }
    setLineItemErrors([]);
  }, [order, form, open]);

  async function onSubmit(values: FormData) {
    // Validate line items
    const errors: string[] = [];

    if (lineItems.length === 0) {
      errors.push('At least one line item is required');
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
      const preview = errors.slice(0, 3).join(' · ');
      const suffix = errors.length > 3 ? ` (+${errors.length - 3} more)` : '';
      toast({
        variant: 'destructive',
        title: 'Line items incomplete',
        description: `${preview}${suffix}`,
      });
      return;
    }

    setLineItemErrors([]);

    const distinctProductIds = [...new Set(lineItems.map((li) => li.product_id).filter(Boolean))];
    try {
      const allowedIds = await fetchWorkspaceActiveProductIdSet();
      const invalidProducts = distinctProductIds.filter((id) => !allowedIds.has(id));
      if (invalidProducts.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Product not available',
          description:
            'A line item references an inactive or unknown product. Pick products again from the catalog.',
        });
        return;
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Could not verify products',
        description: 'Refresh the page and try again.',
      });
      return;
    }

    if (!isEdit) {
      const selectedCustomerRow = customers.find((c) => c.id === values.customer_id);
      if (!selectedCustomerRow) {
        toast({
          variant: 'destructive',
          title: 'Customer not available',
          description:
            'Pick a customer from the list for your workspace. If the list is empty, add a customer or generate sample data from onboarding.',
        });
        void loadCustomers();
        return;
      }
    }

    // PHASE AI: Check for anomalies before creating order
    if (!isEdit && !anomalyDetected) {
      const orderTotal = subtotal + tax;

      try {
        const anomalyCheck = await apiClient.post<{
          is_anomaly: boolean;
          severity: string;
          description: string;
          recommended_action: string;
          confidence: number;
          details: Record<string, unknown>;
        }>('/api/ai/anomaly', {
          detection_type: 'order_amount',
          customer_id: values.customer_id,
          amount: orderTotal,
        });

        // If anomaly detected with high/critical severity, show alert
        if (
          anomalyCheck.is_anomaly &&
          (anomalyCheck.severity === 'high' || anomalyCheck.severity === 'critical')
        ) {
          setAnomalyDetected(anomalyCheck);
          setShowAnomalyAlert(true);
          toast({
            title: 'Review required',
            description: 'This order triggered a risk check. Review the alert in the form, then continue or adjust the order.',
          });
          return; // Stop submission, wait for user confirmation
        }
      } catch (error) {
        console.error('Anomaly check failed:', error);
        // Continue with order creation even if anomaly check fails
      }
    }

    setIsLoading(true);

    try {
      // PHASE 4 OPTIMIZATION: Include item IDs for diff-based updates
      const payload = {
        customer_id: values.customer_id,
        fulfillment_location: values.fulfillment_location,
        status: values.status,
        notes: values.notes || null,
        items: lineItems.map((item) => ({
          id: item.id || undefined, // Include ID for updates (enables diff-based backend logic)
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      };

      if (isEdit && order?.id) {
        await apiClient.put(`/api/orders/${order.id}`, payload);
        toast({
          title: 'Success',
          description: 'Order updated successfully',
        });
        onSuccess({ created: false });
      } else {
        await apiClient.post('/api/orders', payload);
        toast({
          title: 'Success',
          description: 'Order created successfully',
        });
        onSuccess({ created: true });
      }

      // PHASE 4: Add customer to recent items (only when we have a row from the loaded list)
      const recent = customers.find((c) => c.id === values.customer_id);
      if (recent) {
        addRecentCustomer(recent);
      }

      onOpenChange(false);
    } catch (error) {
      let description: string;
      let title = isEdit ? 'Could not update order' : 'Could not create order';

      if (error instanceof ApiClientError) {
        description = error.message;
        if (error.status === 400) {
          title = isEdit ? 'Order update rejected' : 'Order could not be created';
          if (/unknown or inactive product/i.test(description)) {
            title = 'Invalid product on order';
            description =
              'Replace line items with products from your active catalog (inactive items cannot be ordered).';
          }
        } else if (error.status === 401 || error.status === 403) {
          title = 'Session or permission issue';
        } else if (error.status === 404) {
          title =
            !isEdit && /customer not found/i.test(description)
              ? 'Customer not found'
              : 'Order not found';
          if (!isEdit && /customer not found/i.test(description)) {
            description =
              'That customer is not in your workspace or was removed. Refresh and choose a customer from the list.';
          }
        } else if (error.status === 408) {
          title = 'Request timed out';
        }
      } else if (error instanceof Error) {
        description = error.message;
      } else {
        description = `Something went wrong while ${isEdit ? 'updating' : 'creating'} the order.`;
      }

      toast({
        variant: 'destructive',
        title,
        description,
      });
    } finally {
      setIsLoading(false);
    }
  }

  function onSubmitInvalid(errors: FieldErrors<FormData>) {
    const msgs = flattenFormErrorMessages(errors);
    toast({
      variant: 'destructive',
      title: 'Missing or invalid fields',
      description:
        msgs.length > 0
          ? msgs.join(' · ')
          : 'Check customer, location, and status above.',
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Order' : 'Create Order'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the order information and line items below.'
              : 'Fill in the order details and add line items to create a new order.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onSubmitInvalid)} className="space-y-6">
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
                    <div className="mb-2 flex items-center justify-between">
                      <FormLabel>Customer</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuickAddOpen(true)}
                        className="h-6 px-2"
                      >
                        <Plus className="mr-1 h-3 w-3" />
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
                        {recentCustomersValid.length > 0 && (
                          <>
                            {recentCustomersValid.map((customer) => (
                              <SelectItem key={`recent-${customer.id}`} value={customer.id}>
                                🕒 {customer.customer_number} - {customer.company_name}
                              </SelectItem>
                            ))}
                            <div className="my-1 border-t" />
                          </>
                        )}
                        {customers
                          .filter((c) => !recentCustomersValid.some((recent) => recent.id === c.id))
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

            {/* PHASE AI: Product Suggestions */}
            {!isEdit && suggestions?.products && suggestions.products.length > 0 && (
              <div className="space-y-2">
                <ProductAutoFillSuggestion
                  products={suggestions.products}
                  confidence={confidence.products || 0}
                  source={source.products}
                  onApplyProduct={(product) => {
                    setLineItems((prev) => [
                      ...prev,
                      {
                        product_id: product.product_id,
                        sku: product.sku,
                        product_name: product.name,
                        quantity: product.avg_quantity,
                        unit_price: product.price,
                        line_total: product.avg_quantity * product.price,
                      },
                    ]);
                    toast({
                      title: 'Product Added',
                      description: `${product.name} added with quantity ${product.avg_quantity}`,
                    });
                  }}
                  onApplyAll={() => {
                    const newItems = suggestions.products!.map((product) => ({
                      product_id: product.product_id,
                      sku: product.sku,
                      product_name: product.name,
                      quantity: product.avg_quantity,
                      unit_price: product.price,
                      line_total: product.avg_quantity * product.price,
                    }));
                    setLineItems((prev) => [...prev, ...newItems]);
                    toast({
                      title: 'Products Added',
                      description: `Added ${newItems.length} products based on customer history`,
                    });
                  }}
                  onDismiss={() => {
                    // Suggestions dismissed
                  }}
                />
              </div>
            )}

            {/* PHASE AI: Anomaly Alert */}
            {showAnomalyAlert && anomalyDetected && typeof anomalyDetected !== 'string' && (
              <AnomalyAlert
                isAnomaly={anomalyDetected.is_anomaly ?? false}
                severity={anomalyDetected.severity as 'high' | 'low' | 'medium' | 'critical'}
                description={anomalyDetected.description}
                recommendedAction={anomalyDetected.recommended_action}
                confidence={anomalyDetected.confidence}
                details={anomalyDetected.details}
                onProceedAnyway={() => {
                  setShowAnomalyAlert(false);
                  // Resubmit form with anomaly flag set to skip check
                  setAnomalyDetected('bypass');
                  form.handleSubmit(onSubmit)();
                }}
                onDismiss={() => {
                  setShowAnomalyAlert(false);
                  setAnomalyDetected(null);
                }}
              />
            )}

            <OrderLineItems
              items={lineItems}
              onChange={setLineItems}
              errors={lineItemErrors}
              selectedLocation={selectedLocation}
            />

            {lineItems.length > 0 && (
              <div className="bg-muted/50 rounded-lg border p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (10% GST):</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-bold">
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
                {isLoading ? 'Saving...' : isEdit ? 'Update Order' : 'Create Order'}
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
