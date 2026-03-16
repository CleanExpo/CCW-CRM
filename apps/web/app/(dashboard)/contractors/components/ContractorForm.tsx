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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  mobile: z
    .string()
    .min(1, 'Mobile is required')
    .regex(/^04\d{2}\s?\d{3}\s?\d{3}$/, 'Must be a valid Australian mobile (04XX XXX XXX)'),
  abn: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/.test(val),
      'Must be a valid ABN (XX XXX XXX XXX)'
    ),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  specialisation: z.string().max(100, 'Specialisation must be 100 characters or less').optional(),
});

type FormData = z.infer<typeof formSchema>;

export interface Contractor {
  id: string;
  name: string;
  mobile: string;
  abn: string | null;
  email: string | null;
  specialisation: string | null;
  created_at: string;
  updated_at: string;
}

interface ContractorFormProps {
  contractor: Contractor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SPECIALISATION_OPTIONS = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Carpentry',
  'Painting',
  'Landscaping',
  'Concreting',
  'Roofing',
  'Tiling',
  'General Building',
  'Equipment Maintenance',
  'Welding',
  'Other',
];

export function ContractorForm({ contractor, open, onOpenChange, onSuccess }: ContractorFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEdit = !!contractor;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      mobile: '',
      abn: '',
      email: '',
      specialisation: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (contractor) {
        form.reset({
          name: contractor.name,
          mobile: contractor.mobile,
          abn: contractor.abn || '',
          email: contractor.email || '',
          specialisation: contractor.specialisation || '',
        });
      } else {
        form.reset({
          name: '',
          mobile: '',
          abn: '',
          email: '',
          specialisation: '',
        });
      }
    }
  }, [open, contractor, form]);

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      const payload = {
        name: values.name,
        mobile: values.mobile,
        abn: values.abn || null,
        email: values.email || null,
        specialisation: values.specialisation || null,
      };

      if (isEdit) {
        await apiClient.patch(`/contractors/${contractor.id}`, payload);
        toast({ title: 'Success', description: 'Contractor updated successfully' });
      } else {
        await apiClient.post('/contractors/', payload);
        toast({ title: 'Success', description: 'Contractor created successfully' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to ${isEdit ? 'update' : 'create'} contractor`;
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Contractor' : 'Add Contractor'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the contractor information below.'
              : 'Register a new contractor with their Australian details.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile *</FormLabel>
                    <FormControl>
                      <Input placeholder="0412 345 678" {...field} />
                    </FormControl>
                    <FormDescription>Australian mobile (04XX XXX XXX)</FormDescription>
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
                      <Input placeholder="12 345 678 901" {...field} />
                    </FormControl>
                    <FormDescription>Australian Business Number</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jane@contractor.com.au" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specialisation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialisation</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a specialisation" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SPECIALISATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
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
                {isLoading ? 'Saving...' : isEdit ? 'Update Contractor' : 'Add Contractor'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
