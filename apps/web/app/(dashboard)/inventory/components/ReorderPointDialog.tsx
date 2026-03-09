'use client';

import { useState } from 'react';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  reorder_point: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .min(0, 'Reorder point must be 0 or greater'),
  reorder_quantity: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .min(1, 'Reorder quantity must be at least 1'),
});

type FormData = z.infer<typeof formSchema>;

interface ReorderPointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productSku: string;
  location: string;
  currentReorderPoint?: number;
  currentReorderQty?: number;
  onSuccess?: () => void;
}

export function ReorderPointDialog({
  open,
  onOpenChange,
  productId,
  productName,
  productSku,
  location,
  currentReorderPoint,
  currentReorderQty,
  onSuccess,
}: ReorderPointDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reorder_point: currentReorderPoint ?? 10,
      reorder_quantity: currentReorderQty ?? 20,
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      await inventoryApi.updateReorderSettings(
        productId,
        location,
        values.reorder_point,
        values.reorder_quantity
      );

      toast({
        title: 'Reorder Settings Saved',
        description: `Reorder point set to ${values.reorder_point} units, reorder quantity set to ${values.reorder_quantity} units for ${location}.`,
      });

      onSuccess?.();
      onOpenChange(false);
      form.reset();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Failed to Save',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update reorder settings. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const locationLabel = location.charAt(0).toUpperCase() + location.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Reorder Point</DialogTitle>
          <DialogDescription>
            Configure reorder settings for <span className="font-semibold">{productName}</span> (
            {productSku}) at {locationLabel}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reorder_point"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Point (units)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="e.g. 10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reorder_quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Quantity (units)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="e.g. 50" {...field} />
                  </FormControl>
                  <FormMessage />
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
                Save Settings
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
