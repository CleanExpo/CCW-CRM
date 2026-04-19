'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { AlertTriangle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { shipmentsApi, type Shipment } from '@/lib/api';

const schema = z.object({
  declaration_number: z.string().min(1, 'Declaration number is required'),
  attachment_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface ADGDeclarationDialogProps {
  shipment: Shipment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: Shipment) => void;
}

export function ADGDeclarationDialog({
  shipment,
  open,
  onOpenChange,
  onSuccess,
}: ADGDeclarationDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      declaration_number: shipment.adg_declaration_number ?? '',
      attachment_url: shipment.adg_declaration_attachment_url ?? '',
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      const updated = await shipmentsApi.attachAdgDeclaration(shipment.id, {
        declaration_number: values.declaration_number,
        attachment_url: values.attachment_url || undefined,
      });
      toast({
        title: 'ADG declaration attached',
        description: `Declaration ${values.declaration_number} recorded.`,
      });
      onSuccess(updated);
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to attach declaration',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Attach ADG Declaration
          </DialogTitle>
          <DialogDescription>
            Shipment <strong>{shipment.shipment_number}</strong> contains dangerous goods. An ADG
            declaration is required before this shipment can be dispatched.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="declaration_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Declaration Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. DG-2026-00123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="attachment_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Declaration PDF URL (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Attaching…' : 'Attach Declaration'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
