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
import type { Activity } from './ActivityTimeline';

const activityTypes = [
  { value: 'call', label: 'Phone Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' },
] as const;

const formSchema = z.object({
  activity_type: z.enum(['call', 'email', 'meeting', 'note', 'task']),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(255, 'Subject must be 255 characters or less'),
  description: z.string().optional().or(z.literal('')),
  contact_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
}

interface ActivityFormProps {
  activity: Activity | null;
  customerId: string;
  contacts: Contact[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ActivityForm({
  activity,
  customerId,
  contacts,
  open,
  onOpenChange,
  onSuccess,
}: ActivityFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEdit = !!activity;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      activity_type: 'note',
      subject: '',
      description: '',
      contact_id: null,
      due_date: '',
    },
  });

  // Reset form when activity changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      if (activity) {
        form.reset({
          activity_type: activity.activity_type,
          subject: activity.subject,
          description: activity.description || '',
          contact_id: activity.contact_id || null,
          due_date: activity.due_date ? activity.due_date.split('T')[0] : '',
        });
      } else {
        form.reset({
          activity_type: 'note',
          subject: '',
          description: '',
          contact_id: null,
          due_date: '',
        });
      }
    }
  }, [open, activity, form]);

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      const payload = {
        activity_type: values.activity_type,
        subject: values.subject,
        description: values.description || undefined,
        customer_id: customerId,
        contact_id: values.contact_id || undefined,
        due_date: values.due_date || undefined,
      };

      if (isEdit) {
        await apiClient.put(`/api/activities/${activity.id}`, payload);
        toast({
          title: 'Success',
          description: 'Activity updated successfully',
        });
      } else {
        await apiClient.post('/api/activities', payload);
        toast({
          title: 'Success',
          description: 'Activity logged successfully',
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Activity' : 'Log Activity'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the activity details below.'
              : 'Record an interaction or task for this customer.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="activity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activityTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of the activity" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {contacts.length > 0 && (
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Contact</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contact (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No contact</SelectItem>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.first_name} {contact.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      Link this activity to a specific contact
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch('activity_type') === 'task' && (
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      When should this task be completed?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                {isEdit ? 'Update Activity' : 'Log Activity'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
