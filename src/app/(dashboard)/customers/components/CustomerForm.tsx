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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  customer_number: z
    .string()
    .min(1, 'Customer number is required')
    .max(50, 'Customer number must be 50 characters or less'),
  company_name: z
    .string()
    .min(1, 'Company name is required')
    .max(255, 'Company name must be 255 characters or less'),
  contact_name: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  is_active: boolean;
}

interface CustomerFormProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CustomerForm({ customer, open, onOpenChange, onSuccess }: CustomerFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEdit = !!customer;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_number: '',
      company_name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      postcode: '',
      is_active: true,
    },
  });

  // Reset form when customer changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      if (customer) {
        form.reset({
          customer_number: customer.customer_number,
          company_name: customer.company_name,
          contact_name: customer.contact_name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
          city: customer.city || '',
          state: customer.state || '',
          postcode: customer.postcode || '',
          is_active: customer.is_active,
        });
      } else {
        form.reset({
          customer_number: '',
          company_name: '',
          contact_name: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          state: '',
          postcode: '',
          is_active: true,
        });
      }
    }
  }, [open, customer, form]);

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      if (isEdit) {
        await apiClient.put(`/api/customers/${customer.id}`, values);
        toast({
          title: 'Success',
          description: 'Customer updated successfully',
        });
      } else {
        await apiClient.post('/api/customers', values);
        toast({
          title: 'Success',
          description: 'Customer created successfully',
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to ${isEdit ? 'update' : 'create'} customer`;
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Customer' : 'Create Customer'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the customer information below.'
              : 'Add a new customer to your directory.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="CUST-001" {...field} disabled={isEdit} />
                    </FormControl>
                    {isEdit && <FormDescription>Customer number cannot be changed</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="ACME Corporation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@acme.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="123 Main Street" className="min-h-[60px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Sydney" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="NSW" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode</FormLabel>
                    <FormControl>
                      <Input placeholder="2000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem>
                  <div
                    className={cn(
                      'flex flex-col gap-4 rounded-xl border-2 p-4 shadow-sm transition-colors sm:flex-row sm:items-center sm:justify-between',
                      field.value
                        ? 'border-emerald-300/80 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/40'
                        : 'border-amber-300/80 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/40',
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                      <Badge
                        variant={field.value ? 'success' : 'secondary'}
                        className="h-7 shrink-0 px-3 text-xs font-semibold uppercase tracking-wide"
                      >
                        {field.value ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="min-w-0 space-y-1">
                        <FormLabel className="text-base font-semibold">Customer status</FormLabel>
                        <FormDescription
                          className={cn(
                            field.value
                              ? 'text-emerald-950 dark:text-emerald-100/90'
                              : 'text-amber-950 dark:text-amber-100/90',
                          )}
                        >
                          {field.value
                            ? 'This customer appears in directory, orders, and CRM.'
                            : 'Inactive customers are hidden from active listings until you turn this back on.'}
                        </FormDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-black/5 pt-3 dark:border-white/10 sm:border-t-0 sm:pt-0">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          field.value
                            ? 'text-emerald-800 dark:text-emerald-200'
                            : 'text-amber-800 dark:text-amber-200',
                        )}
                      >
                        {field.value ? 'Available for sales' : 'Not available for new activity'}
                      </span>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label={
                            field.value
                              ? 'Customer is active; switch to deactivate'
                              : 'Customer is inactive; switch to activate'
                          }
                          className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-zinc-400 dark:data-[state=unchecked]:bg-zinc-600"
                        />
                      </FormControl>
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
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
                {isLoading ? 'Saving...' : isEdit ? 'Update Customer' : 'Create Customer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
