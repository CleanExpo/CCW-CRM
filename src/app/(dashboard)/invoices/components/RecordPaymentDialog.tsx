'use client';

import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { invoicesApi } from '@/lib/api/invoices';
import type { Invoice, InvoiceSummary, PaymentMethod } from '@/types/invoices';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const paymentSchema = z.object({
  amount: z
    .string()
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      'Amount must be greater than 0'
    ),
  // Card/Stripe payments are applied only via signed Stripe webhooks.
  payment_method: z.enum(['cash', 'check', 'bank_transfer', 'other'] as const),
  payment_date: z.string().optional(),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface RecordPaymentDialogProps {
  invoice: Invoice | InvoiceSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded: () => void;
}

export function RecordPaymentDialog({
  invoice,
  open,
  onOpenChange,
  onPaymentRecorded,
}: RecordPaymentDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const maxAmount =
    typeof invoice.amount_due === 'string' ? parseFloat(invoice.amount_due) : invoice.amount_due;

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: maxAmount.toString(),
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: '',
    },
  });

  const onSubmit = async (data: PaymentFormData) => {
    setIsLoading(true);
    try {
      await invoicesApi.recordPayment(invoice.id, {
        amount: parseFloat(data.amount),
        payment_method: data.payment_method as PaymentMethod,
        payment_date: data.payment_date || new Date().toISOString().split('T')[0],
        reference_number: data.reference_number || undefined,
        notes: data.notes || undefined,
      });

      toast({
        title: 'Payment recorded',
        description: `Payment of $${data.amount} has been recorded successfully`,
      });

      form.reset();
      onPaymentRecorded();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to record payment';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Invoice {invoice.invoice_number} • Amount Due: ${maxAmount.toFixed(2)}. Card payments
            are recorded automatically by Stripe — use this form for cash, EFT, or cheque only.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>Maximum: ${maxAmount.toFixed(2)}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Cheque</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer / EFT</SelectItem>
                      <SelectItem value="other">Other (offline)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="EFT receipt, cheque #, bank reference"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Required for EFT / cheque — kept for the payment audit trail.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes about this payment..."
                      className="resize-none"
                      {...field}
                      disabled={isLoading}
                    />
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
                {isLoading ? 'Recording...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
