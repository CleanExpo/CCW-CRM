'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  supplier_name: z.string().optional(),
  auto_approve_under_qty: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .min(0, 'Must be 0 or greater')
    .default(0),
  lead_time_days: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 day')
    .default(7),
  is_enabled: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface ReorderRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productSku: string;
  location: string;
  onSuccess?: () => void;
}

export function ReorderRuleDialog({
  open,
  onOpenChange,
  productId,
  productName,
  productSku,
  location,
  onSuccess,
}: ReorderRuleDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_name: '',
      auto_approve_under_qty: 0,
      lead_time_days: 7,
      is_enabled: true,
    },
  });

  // Load existing rule when dialog opens
  useEffect(() => {
    if (!open) return;
    inventoryApi
      .getReorderRules(location)
      .then((rules) => {
        const existing = rules.find((r) => r.product_id === productId);
        if (existing) {
          form.reset({
            supplier_name: '',
            auto_approve_under_qty: existing.auto_approve_under_qty,
            lead_time_days: existing.lead_time_days,
            is_enabled: existing.is_enabled,
          });
        }
      })
      .catch(() => {
        /* silent — no existing rule is fine */
      });
  }, [open, productId, location, form]);

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      await inventoryApi.saveReorderRule({
        product_id: productId,
        location,
        auto_approve_under_qty: values.auto_approve_under_qty,
        lead_time_days: values.lead_time_days,
        is_enabled: values.is_enabled,
      });

      toast({
        title: 'Reorder Rule Saved',
        description: `Auto-reorder configured for ${productName} at ${location}. Lead time: ${values.lead_time_days} days.`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Failed to Save Rule',
        description:
          error instanceof Error ? error.message : 'Could not save reorder rule. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const locationLabel = location.charAt(0).toUpperCase() + location.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Configure Reorder Rule</DialogTitle>
          <DialogDescription>
            Set auto-reorder parameters for <span className="font-semibold">{productName}</span> (
            {productSku}) at {locationLabel}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="auto_approve_under_qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auto-Approve Under Qty</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="e.g. 50" {...field} />
                  </FormControl>
                  <FormDescription>
                    POs under this quantity are auto-approved. Set 0 to require manual approval.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lead_time_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Time (days)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="e.g. 7" {...field} />
                  </FormControl>
                  <FormDescription>Expected supplier delivery time in days.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-sm font-medium">Enable Auto-Reorder</FormLabel>
                    <FormDescription className="text-xs">
                      When enabled, this rule triggers PO creation automatically.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

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
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Rule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
