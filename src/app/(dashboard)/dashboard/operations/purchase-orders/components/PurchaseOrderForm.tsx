'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { useLineItemCalculations } from '@/hooks/use-line-item-calculations';
import { useAutosave } from '@/hooks/use-autosave';
import { DraftRecoveryAlert } from '@/components/ui/draft-recovery-alert';
import { SupplierSelect } from './SupplierSelect';
import { PurchaseOrderLineItems } from './PurchaseOrderLineItems';
import type { PurchaseOrder, PurchaseOrderItem, DeliveryLocation } from '../types';

const formSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  delivery_location: z.enum(['brisbane', 'sydney', 'melbourne'], {
    required_error: 'Delivery location is required',
  }),
  expected_delivery_date: z.string().optional(),
  shipping_cost: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PurchaseOrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder;
  mode: 'create' | 'edit';
}

export function PurchaseOrderForm({
  open,
  onOpenChange,
  purchaseOrder,
  mode,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [lineItems, setLineItems] = useState<PurchaseOrderItem[]>([]);
  const { config, calculateTotalsForItems } = useLineItemCalculations();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: purchaseOrder?.supplier_id || '',
      delivery_location: purchaseOrder?.delivery_location || 'brisbane',
      expected_delivery_date: purchaseOrder?.expected_delivery_date
        ? new Date(purchaseOrder.expected_delivery_date).toISOString().split('T')[0]
        : '',
      shipping_cost: purchaseOrder?.shipping_cost?.toString() || '',
      notes: purchaseOrder?.notes || '',
    },
  });

  // Autosave hook - prevents data loss on dialog close/navigation
  const draftKey = mode === 'edit' ? `po-form-${purchaseOrder?.id}` : 'po-form-new';
  const { hasDraft, draftMetadata, loadDraft, clearDraft } = useAutosave({
    key: draftKey,
    formValues: {
      ...form.watch(),
      lineItems, // Include line items in autosave
    },
    onRestore: (draft) => {
      Object.keys(draft).forEach((key) => {
        if (key !== 'lineItems') {
          form.setValue(key as keyof FormData, draft[key as keyof FormData]);
        }
      });
      if (Array.isArray(draft.lineItems) && draft.lineItems.length > 0) {
        setLineItems(draft.lineItems);
      }
    },
    enabled: open && mode === 'create',
    debounceMs: 2000,
  });

  // Initialize line items when editing
  useEffect(() => {
    if (mode === 'edit' && purchaseOrder?.items) {
      setLineItems(
        purchaseOrder.items.map((item) => ({
          ...item,
          calculationMode: 'unit_cost' as const, // Default mode
        }))
      );
    } else if (mode === 'create' && lineItems.length === 0) {
      // Add first empty item for create mode
      setLineItems([
        {
          product_id: '',
          quantity: 1,
          quantity_received: 0,
          unit_cost: 0,
          subtotal: 0,
          calculationMode: 'unit_cost',
        },
      ]);
    }
  }, [mode, purchaseOrder, lineItems.length]);

  async function onSubmit(values: FormData) {
    // Validation
    if (lineItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one line item',
        variant: 'destructive',
      });
      return;
    }

    const invalidItems = lineItems.filter(
      (item) => !item.product_id || item.quantity <= 0 || item.unit_cost < 0
    );

    if (invalidItems.length > 0) {
      toast({
        title: 'Error',
        description: 'Please complete all line items with valid data',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        supplier_id: values.supplier_id,
        delivery_location: values.delivery_location,
        expected_delivery_date: values.expected_delivery_date || null,
        notes: values.notes || null,
        shipping_cost: values.shipping_cost ? parseFloat(values.shipping_cost) : null,
        items: lineItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        })),
      };

      if (mode === 'create') {
        await apiClient.post('/api/purchase-orders', payload);
        toast({
          title: 'Success',
          description: 'Purchase order created successfully',
        });
      } else {
        await apiClient.put(`/api/purchase-orders/${purchaseOrder?.id}`, payload);
        toast({
          title: 'Success',
          description: 'Purchase order updated successfully',
        });
      }

      clearDraft(); // Clear autosave draft on success
      onOpenChange(false);
      router.refresh();
    } catch (error: unknown) {
      console.error('Failed to save purchase order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save purchase order',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate totals
  const shippingCost = parseFloat(form.watch('shipping_cost') || '0');
  const totals = calculateTotalsForItems(
    lineItems.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_cost, // For PO, unit_price is unit_cost
      line_total: item.subtotal,
    }))
  );
  const grandTotal = totals.total + shippingCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Purchase Order' : 'Edit Purchase Order'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new purchase order for supplier goods.'
              : 'Update purchase order details.'}
          </DialogDescription>
        </DialogHeader>

        {/* Draft Recovery Alert */}
        {hasDraft && mode === 'create' && draftMetadata && (
          <DraftRecoveryAlert
            savedAt={draftMetadata.savedAt}
            onRestore={loadDraft}
            onDiscard={clearDraft}
          />
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Supplier */}
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier *</FormLabel>
                    <FormControl>
                      <SupplierSelect
                        value={field.value}
                        onSelect={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Location */}
              <FormField
                control={form.control}
                name="delivery_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Location *</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Expected Delivery Date */}
              <FormField
                control={form.control}
                name="expected_delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Delivery Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Shipping Cost */}
              <FormField
                control={form.control}
                name="shipping_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Cost</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      placeholder="Add any additional notes..."
                      className="min-h-[80px]"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Line Items */}
            <PurchaseOrderLineItems
              items={lineItems}
              onChange={setLineItems}
              selectedLocation={form.watch('delivery_location')}
            />

            {/* Totals Summary */}
            <div className="bg-muted/50 space-y-2 rounded-lg border p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{config.taxName}:</span>
                <span className="font-medium">${totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping:</span>
                <span className="font-medium">${shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total:</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? 'Saving...'
                  : mode === 'create'
                    ? 'Create Purchase Order'
                    : 'Update Purchase Order'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
