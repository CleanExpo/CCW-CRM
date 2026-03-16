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
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { ServiceRequest } from '@/lib/api/service-requests';

const createSchema = z.object({
  customer_id: z.string().uuid('Must be a valid customer ID'),
  request_type: z.enum(
    ['repair', 'maintenance', 'inspection', 'installation', 'warranty', 'other'],
    { required_error: 'Request type is required' }
  ),
  equipment_description: z.string().min(1, 'Equipment description is required').max(5000),
  issue_description: z.string().min(1, 'Issue description is required').max(5000),
});

const updateSchema = z.object({
  status: z
    .enum([
      'submitted',
      'under_review',
      'quote_sent',
      'approved',
      'scheduled',
      'in_progress',
      'completed',
      'cancelled',
    ])
    .optional(),
  assigned_technician: z.string().optional(),
  scheduled_date: z.string().optional(),
  quote_amount: z.coerce.number().min(0).optional(),
  approved_amount: z.coerce.number().min(0).optional(),
});

type CreateFormData = z.infer<typeof createSchema>;
type UpdateFormData = z.infer<typeof updateSchema>;

interface ServiceRequestFormProps {
  serviceRequest: ServiceRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const REQUEST_TYPES = [
  { value: 'repair', label: 'Repair' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'installation', label: 'Installation' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'quote_sent', label: 'Quote Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ServiceRequestForm({
  serviceRequest,
  open,
  onOpenChange,
  onSuccess,
}: ServiceRequestFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEdit = !!serviceRequest;

  // Use two separate forms for create vs. edit
  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      customer_id: '',
      request_type: 'repair',
      equipment_description: '',
      issue_description: '',
    },
  });

  const updateForm = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      status: undefined,
      assigned_technician: '',
      scheduled_date: '',
      quote_amount: undefined,
      approved_amount: undefined,
    },
  });

  useEffect(() => {
    if (open && serviceRequest) {
      updateForm.reset({
        status: serviceRequest.status as UpdateFormData['status'],
        assigned_technician: serviceRequest.assigned_technician || '',
        scheduled_date: serviceRequest.scheduled_date
          ? serviceRequest.scheduled_date.slice(0, 16)
          : '',
        quote_amount: serviceRequest.quote_amount ?? undefined,
        approved_amount: serviceRequest.approved_amount ?? undefined,
      });
    } else if (open && !serviceRequest) {
      createForm.reset({
        customer_id: '',
        request_type: 'repair',
        equipment_description: '',
        issue_description: '',
      });
    }
  }, [open, serviceRequest, createForm, updateForm]);

  async function onCreateSubmit(values: CreateFormData) {
    setIsLoading(true);
    try {
      await apiClient.post('/api/service-requests', values);
      toast({ title: 'Success', description: 'Service request created successfully' });
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create service request';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  async function onUpdateSubmit(values: UpdateFormData) {
    if (!serviceRequest) return;
    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (values.status) payload.status = values.status;
      if (values.assigned_technician) payload.assigned_technician = values.assigned_technician;
      if (values.scheduled_date) payload.scheduled_date = values.scheduled_date;
      if (values.quote_amount !== undefined) payload.quote_amount = values.quote_amount;
      if (values.approved_amount !== undefined) payload.approved_amount = values.approved_amount;

      await apiClient.patch(`/api/service-requests/${serviceRequest.id}`, payload);
      toast({ title: 'Success', description: 'Service request updated successfully' });
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update service request';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Update Service Request</DialogTitle>
            <DialogDescription>
              Update the status and details for this service request.
            </DialogDescription>
          </DialogHeader>

          <Form {...updateForm}>
            <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <div className="bg-muted/30 space-y-1 rounded-md border p-3 text-sm">
                <p className="font-medium">Equipment</p>
                <p className="text-muted-foreground">{serviceRequest?.equipment_description}</p>
                <p className="mt-2 font-medium">Issue</p>
                <p className="text-muted-foreground">{serviceRequest?.issue_description}</p>
              </div>

              <FormField
                control={updateForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={updateForm.control}
                name="assigned_technician"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Technician</FormLabel>
                    <FormControl>
                      <Input placeholder="Technician name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={updateForm.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={updateForm.control}
                  name="quote_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quote Amount ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? undefined : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={updateForm.control}
                  name="approved_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Approved Amount ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? undefined : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                  {isLoading ? 'Saving...' : 'Update Request'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Service Request</DialogTitle>
          <DialogDescription>Submit a new service request for a customer.</DialogDescription>
        </DialogHeader>

        <Form {...createForm}>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
            <FormField
              control={createForm.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer ID *</FormLabel>
                  <FormControl>
                    <Input placeholder="UUID of the customer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={createForm.control}
              name="request_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Request Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select request type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REQUEST_TYPES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={createForm.control}
              name="equipment_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipment Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the equipment (make, model, serial number, etc.)"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={createForm.control}
              name="issue_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the problem in detail..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
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
                {isLoading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
