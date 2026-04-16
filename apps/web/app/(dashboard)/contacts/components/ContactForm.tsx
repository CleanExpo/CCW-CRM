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

const formSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or less'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or less'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(30, 'Phone must be 30 characters or less').optional().or(z.literal('')),
  mobile: z.string().max(30, 'Mobile must be 30 characters or less').optional().or(z.literal('')),
  job_title: z
    .string()
    .max(100, 'Job title must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  department: z
    .string()
    .max(100, 'Department must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  is_primary: z.boolean().default(false),
  is_active: z.boolean().default(true),
  customer_id: z.string().uuid().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface Contact {
  id: string;
  customer_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  notes?: string | null;
  is_primary: boolean;
  is_active: boolean;
}

interface ContactFormProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  customerId?: string;
}

export function ContactForm({
  contact,
  open,
  onOpenChange,
  onSuccess,
  customerId,
}: ContactFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEdit = !!contact;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      job_title: '',
      department: '',
      notes: '',
      is_primary: false,
      is_active: true,
      customer_id: customerId || null,
    },
  });

  // Reset form when contact changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      if (contact) {
        form.reset({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email || '',
          phone: contact.phone || '',
          mobile: contact.mobile || '',
          job_title: contact.job_title || '',
          department: contact.department || '',
          notes: contact.notes || '',
          is_primary: contact.is_primary,
          is_active: contact.is_active,
          customer_id: contact.customer_id || customerId || null,
        });
      } else {
        form.reset({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          mobile: '',
          job_title: '',
          department: '',
          notes: '',
          is_primary: false,
          is_active: true,
          customer_id: customerId || null,
        });
      }
    }
  }, [open, contact, form, customerId]);

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      // Clean up empty strings to null for optional fields
      const cleanedValues = {
        ...values,
        email: values.email || undefined,
        phone: values.phone || undefined,
        mobile: values.mobile || undefined,
        job_title: values.job_title || undefined,
        department: values.department || undefined,
        notes: values.notes || undefined,
        customer_id: values.customer_id || undefined,
      };

      if (isEdit) {
        await apiClient.put(`/api/contacts/${contact.id}`, cleanedValues);
        toast({
          title: 'Success',
          description: 'Contact updated successfully',
        });
      } else {
        await apiClient.post('/api/contacts', cleanedValues);
        toast({
          title: 'Success',
          description: 'Contact created successfully',
        });
      }
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Contact' : 'New Contact'}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the contact's information below." : 'Add a new contact to your CRM.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact info */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+61 2 1234 5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile</FormLabel>
                    <FormControl>
                      <Input placeholder="+61 4xx xxx xxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Professional info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="job_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Sales Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input placeholder="Sales" {...field} />
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
                      placeholder="Any additional notes about this contact..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Toggles */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <FormField
                control={form.control}
                name="is_primary"
                render={({ field }) => (
                  <FormItem className="flex items-center space-y-0 space-x-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div>
                      <FormLabel className="cursor-pointer">Primary Contact</FormLabel>
                      <FormDescription className="text-xs">
                        Mark as the main contact for the company
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center space-y-0 space-x-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div>
                      <FormLabel className="cursor-pointer">Active</FormLabel>
                      <FormDescription className="text-xs">
                        Contact is currently active
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4">
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
                {isEdit ? 'Update Contact' : 'Create Contact'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
