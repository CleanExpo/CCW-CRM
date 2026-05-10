'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { suppliersApi, type Supplier, type SupplierCreate } from '@/lib/api/suppliers';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Validation schema
const formSchema = z.object({
  supplier_code: z.string().min(1, 'Supplier code is required').max(50, 'Maximum 50 characters'),
  company_name: z.string().min(1, 'Company name is required').max(255, 'Maximum 255 characters'),
  contact_name: z.string().max(255, 'Maximum 255 characters').optional(),
  email: z.string().email('Invalid email address').or(z.literal('')).optional(),
  phone: z.string().max(50, 'Maximum 50 characters').optional(),
  abn: z.string().max(20, 'Maximum 20 characters').optional(),
  address: z.string().optional(),
  city: z.string().max(100, 'Maximum 100 characters').optional(),
  state: z.string().max(50, 'Maximum 50 characters').optional(),
  postal_code: z.string().max(20, 'Maximum 20 characters').optional(),
  country: z.string().max(2, 'Use 2-letter country code').default('AU'),
  payment_terms: z.string().max(100, 'Maximum 100 characters').optional(),
  preferred_carrier: z.string().max(100, 'Maximum 100 characters').optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SupplierFormProps {
  mode: 'create' | 'edit';
  initialData?: Supplier;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Australian states for dropdown
const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
];

export function SupplierForm({ mode, initialData, onSuccess, onCancel }: SupplierFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          supplier_code: initialData.supplier_code,
          company_name: initialData.company_name,
          contact_name: initialData.contact_name || '',
          email: initialData.email || '',
          phone: initialData.phone || '',
          abn: initialData.abn || '',
          address: initialData.address || '',
          city: initialData.city || '',
          state: initialData.state || '',
          postal_code: initialData.postal_code || '',
          country: initialData.country || 'AU',
          payment_terms: initialData.payment_terms || '',
          preferred_carrier: initialData.preferred_carrier || '',
          notes: initialData.notes || '',
        }
      : {
          supplier_code: '',
          company_name: '',
          contact_name: '',
          email: '',
          phone: '',
          abn: '',
          address: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'AU',
          payment_terms: '',
          preferred_carrier: '',
          notes: '',
        },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);

    try {
      if (mode === 'create') {
        // Type-cast to SupplierCreate (validation already ensures required fields)
        await suppliersApi.create(values as SupplierCreate);
        toast({
          title: 'Success',
          description: `Supplier "${values.company_name}" created successfully`,
        });
      } else if (initialData) {
        // For edit mode, exclude supplier_code from update
        const { supplier_code, ...updateData } = values;
        await suppliersApi.update(initialData.id, updateData);
        toast({
          title: 'Success',
          description: `Supplier "${values.company_name}" updated successfully`,
        });
      }

      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      toast({
        variant: 'destructive',
        title: mode === 'create' ? 'Create Failed' : 'Update Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Essential Information */}
        <div className="space-y-4">
          <h3 className="text-muted-foreground text-sm font-medium">Essential Information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="supplier_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Code *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="SUP-001"
                      {...field}
                      disabled={mode === 'edit' || isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    {mode === 'edit' ? 'Cannot be changed after creation' : 'Unique identifier'}
                  </FormDescription>
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
                    <Input placeholder="ACME Corporation" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-muted-foreground text-sm font-medium">Contact Information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Smith" {...field} disabled={isLoading} />
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
                    <Input
                      type="email"
                      placeholder="supplier@example.com"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+61 2 9999 9999" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="abn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ABN</FormLabel>
                  <FormControl>
                    <Input placeholder="51 824 753 556" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormDescription>Australian Business Number</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Address Information */}
        <div className="space-y-4">
          <h3 className="text-muted-foreground text-sm font-medium">Address</h3>
          <div className="grid grid-cols-1 gap-4">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main Street" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Sydney" {...field} disabled={isLoading} />
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AUSTRALIAN_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
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
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode</FormLabel>
                    <FormControl>
                      <Input placeholder="2000" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Business Information */}
        <div className="space-y-4">
          <h3 className="text-muted-foreground text-sm font-medium">Business Terms</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="payment_terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <FormControl>
                    <Input placeholder="Net 30" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormDescription>e.g., Net 30, Net 60, COD</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="preferred_carrier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Carrier</FormLabel>
                  <FormControl>
                    <Input placeholder="Australia Post" {...field} disabled={isLoading} />
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
                  placeholder="Additional information about this supplier..."
                  className="min-h-[100px]"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create Supplier' : 'Update Supplier'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
