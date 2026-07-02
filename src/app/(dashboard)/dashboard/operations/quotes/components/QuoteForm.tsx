'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { QuoteLineItems, LineItem } from './QuoteLineItems';
import { Quote, Customer, QuoteItem } from '../types';
import { useRecentItems } from '@/hooks/use-recent-items';
// PHASE C: AI Quote Assistant imports
import { AIQuoteGenerator } from '@/components/ai/AIQuoteGenerator';
import { Sparkles } from 'lucide-react';

const QUOTE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
] as const;

const formSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  fulfillment_location: z.string().min(1, 'Fulfillment location is required'),
  status: z.string().min(1, 'Status is required'),
  quote_date: z.string().min(1, 'Quote date is required'),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface QuoteFormProps {
  quote?: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface CustomersResponse {
  items: Customer[];
}

export function QuoteForm({ quote, open, onOpenChange, onSuccess }: QuoteFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemErrors, setLineItemErrors] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('brisbane');
  const [aiDialogOpen, setAiDialogOpen] = useState(false); // PHASE C: AI dialog state
  // Gated off by default: /api/ai/generate/quote is not implemented, so the
  // generator 404s on every use (UNI-2120). Enable once the endpoint exists.
  const aiQuoteGeneratorEnabled = process.env.NEXT_PUBLIC_FEATURE_AI_QUOTE_GENERATOR === 'true';
  const { toast } = useToast();
  const isEdit = !!quote;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: '',
      fulfillment_location: 'brisbane',
      status: 'draft',
      quote_date: new Date().toISOString().split('T')[0],
      valid_until: '',
      notes: '',
    },
  });

  // PHASE 4: Recent customers cache
  const { recentItems: recentCustomers, addRecentItem: addRecentCustomer } =
    useRecentItems<Customer>({
      key: 'recent-customers',
      maxItems: 10,
    });

  // Load customers
  useEffect(() => {
    async function loadCustomers() {
      try {
        const response = await apiClient.get<CustomersResponse>(
          '/api/customers?page=1&page_size=100'
        );
        setCustomers(response.items || []);
      } catch (error: unknown) {
        console.error('Failed to load customers:', error);
      }
    }
    loadCustomers();
  }, []);

  // Reset form when quote changes or dialog opens
  useEffect(() => {
    if (quote) {
      const location = quote.fulfillment_location || 'brisbane';
      setSelectedLocation(location);
      form.reset({
        customer_id: quote.customer_id,
        fulfillment_location: location,
        status: quote.status,
        quote_date: quote.quote_date
          ? new Date(quote.quote_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        valid_until: quote.valid_until
          ? new Date(quote.valid_until).toISOString().split('T')[0]
          : '',
        notes: quote.notes || '',
      });
      // Convert decimal strings to numbers for proper calculations
      const rawItems: QuoteItem[] = quote.items || quote.quote_items || [];
      const normalizedItems = rawItems
        .filter((item) => item.product_id) // Filter out items without product_id
        .map((item) => ({
          ...item,
          product_id: item.product_id!, // Assert product_id is present after filter
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          line_total: Number(item.line_total ?? 0),
        }));
      setLineItems(normalizedItems);
    } else {
      // Default valid_until to 30 days from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const validUntilDefault = futureDate.toISOString().split('T')[0];

      setSelectedLocation('brisbane');
      form.reset({
        customer_id: '',
        fulfillment_location: 'brisbane',
        status: 'draft',
        quote_date: new Date().toISOString().split('T')[0],
        valid_until: validUntilDefault,
        notes: '',
      });
      setLineItems([]);
    }
    setLineItemErrors([]);
  }, [quote, form, open]);

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

    // Validate valid_until is in the future
    if (values.valid_until) {
      const validUntilDate = new Date(values.valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validUntilDate < today) {
        errors.push('Valid Until date must be in the future');
      }
    }

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
        valid_until: values.valid_until || null,
        notes: values.notes || null,
        items: lineItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      };

      if (isEdit && quote) {
        await apiClient.put(`/api/quotes/${quote.id}`, payload);
        toast({
          title: 'Success',
          description: 'Quote updated successfully',
        });
      } else {
        await apiClient.post('/api/quotes', payload);
        toast({
          title: 'Success',
          description: 'Quote created successfully',
        });
      }

      // PHASE 4: Add customer to recent items
      const selectedCustomer = customers.find((c) => c.id === values.customer_id);
      if (selectedCustomer) {
        addRecentCustomer(selectedCustomer);
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : `Failed to ${isEdit ? 'update' : 'create'} quote`;
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  const total = lineItems.reduce((sum, item) => sum + item.line_total, 0);

  // PHASE C: Handler for AI-generated quote data
  const handleAIQuoteGenerated = (aiQuoteData: Record<string, unknown>) => {
    // Pre-fill customer if provided
    if (aiQuoteData.customer_id) {
      form.setValue('customer_id', aiQuoteData.customer_id as string);
    }

    // Pre-fill notes with AI description
    if (aiQuoteData.notes) {
      form.setValue('notes', aiQuoteData.notes as string);
    }

    // Pre-fill line items
    if (aiQuoteData.items && Array.isArray(aiQuoteData.items)) {
      const mappedItems = (aiQuoteData.items as Array<Record<string, unknown>>).map((item) => ({
        product_id: item.product_id as string,
        product_name: item.name as string,
        quantity: item.quantity as number,
        unit_price: item.unit_price as number,
        line_total: item.line_total as number,
      }));
      setLineItems(mappedItems);
    }

    toast({
      title: 'Quote Pre-Filled',
      description: `AI suggested ${Array.isArray(aiQuoteData.items) ? aiQuoteData.items.length : 0} products. Review and adjust as needed.`,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex w-full items-center justify-between">
              <span>{isEdit ? 'Edit Quote' : 'Create Quote'}</span>
              {!isEdit && aiQuoteGeneratorEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAiDialogOpen(true)}
                  type="button"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with AI
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update the quote information and line items below.'
                : 'Fill in the quote details and add line items to create a new quote.'}
            </DialogDescription>
          </DialogHeader>

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
                      <FormLabel>Customer</FormLabel>
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
                              <div className="my-1 border-t" />
                            </>
                          )}
                          {customers
                            .filter((c) => !recentCustomers.some((recent) => recent.id === c.id))
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
                          {QUOTE_STATUSES.map((status) => (
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quote_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quote Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valid_until"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
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
                        placeholder="Quote notes or special terms..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <QuoteLineItems
                items={lineItems}
                onChange={setLineItems}
                errors={lineItemErrors}
                selectedLocation={selectedLocation}
              />

              {lineItems.length > 0 && (
                <div className="bg-muted/50 rounded-lg border p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-base font-bold">
                      <span>Quote Total:</span>
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
                  {isLoading ? 'Saving...' : isEdit ? 'Update Quote' : 'Create Quote'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* PHASE C: AI Quote Assistant */}
      {aiQuoteGeneratorEnabled && (
        <AIQuoteGenerator
          open={aiDialogOpen}
          onOpenChange={setAiDialogOpen}
          customerId={form.watch('customer_id')}
          onQuoteGenerated={handleAIQuoteGenerated}
        />
      )}
    </>
  );
}
