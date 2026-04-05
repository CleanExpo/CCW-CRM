"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  FormDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { activitiesApi } from "@/lib/api/activities";
import { ActivityType } from "@/lib/types/activities";
import type { ActivityWithRelations } from "@/lib/types/activities";

const activitySchema = z.object({
  activity_type: z.enum(["call", "email", "meeting", "note", "task"], {
    required_error: "Activity type is required",
  }),
  subject: z.string().min(1, "Subject is required").max(255, "Subject too long"),
  description: z.string().optional(),
  customer_id: z.string().optional(),
  contact_id: z.string().optional(),
  order_id: z.string().optional(),
  quote_id: z.string().optional(),
  due_date: z.string().optional(),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface ActivityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: ActivityWithRelations | null;
  quickType?: ActivityType | null; // Pre-select type for quick actions
  onSuccess: () => void;
}

export function ActivityForm({
  open,
  onOpenChange,
  activity,
  quickType,
  onSuccess,
}: ActivityFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEdit = !!activity;

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      activity_type: activity?.activity_type || quickType || "note",
      subject: activity?.subject || "",
      description: activity?.description || "",
      customer_id: activity?.customer_id || "",
      contact_id: activity?.contact_id || "",
      order_id: activity?.order_id || "",
      quote_id: activity?.quote_id || "",
      due_date: activity?.due_date
        ? new Date(activity.due_date).toISOString().slice(0, 16)
        : "",
    },
  });

  async function onSubmit(values: ActivityFormData) {
    setIsLoading(true);
    try {
      const payload = {
        activity_type: values.activity_type as ActivityType,
        subject: values.subject,
        description: values.description || undefined,
        customer_id: values.customer_id || undefined,
        contact_id: values.contact_id || undefined,
        order_id: values.order_id || undefined,
        quote_id: values.quote_id || undefined,
        due_date: values.due_date ? new Date(values.due_date).toISOString() : undefined,
      };

      if (isEdit && activity) {
        await activitiesApi.update(activity.id, payload);
        toast({
          title: "Success",
          description: "Activity updated successfully",
        });
      } else {
        await activitiesApi.create(payload);
        toast({
          title: "Success",
          description: "Activity created successfully",
        });
      }

      form.reset();
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Operation failed";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Watch activity type to show/hide due date field
  const activityType = form.watch("activity_type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Activity" : "Log Activity"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the activity details below."
              : "Track a customer interaction or create a task."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Activity Type */}
            <FormField
              control={form.control}
              name="activity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select activity type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="call">📞 Call</SelectItem>
                      <SelectItem value="email">📧 Email</SelectItem>
                      <SelectItem value="meeting">📅 Meeting</SelectItem>
                      <SelectItem value="note">📝 Note</SelectItem>
                      <SelectItem value="task">✅ Task</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Type of interaction or task</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Follow-up on pricing quote"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes or details..."
                      className="resize-none"
                      rows={4}
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Customer ID */}
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Link to customer
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact ID */}
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Link to contact
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Order ID */}
              <FormField
                control={form.control}
                name="order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Link to order
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quote ID */}
              <FormField
                control={form.control}
                name="quote_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quote ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Link to quote
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Due Date (for tasks only) */}
            {activityType === "task" && (
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      When this task should be completed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                {isLoading ? "Saving..." : isEdit ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
