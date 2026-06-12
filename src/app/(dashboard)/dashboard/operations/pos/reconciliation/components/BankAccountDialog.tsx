'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  createBankAccount,
  updateBankAccount,
  type BankAccount,
  type BankAccountCreateData,
  type BankAccountUpdateData,
} from '@/lib/api/pos';

const bankAccountSchema = z.object({
  account_name: z.string().min(1, 'Account name is required'),
  account_number: z.string().min(1, 'Account number is required'),
  bsb: z.string().regex(/^\d{3}-\d{3}$/, 'BSB must be in format XXX-XXX (e.g., 123-456)'),
  bank_name: z.string().min(1, 'Bank name is required'),
  account_type: z.enum(['checking', 'savings', 'credit']),
  feed_provider: z.enum(['xero', 'yodlee', 'basiq', 'cdr', 'manual']),
  is_active: z.boolean(),
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;

interface BankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  account?: BankAccount;
  onSuccess: () => void;
}

export function BankAccountDialog({
  open,
  onOpenChange,
  mode,
  account,
  onSuccess,
}: BankAccountDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      account_name: '',
      account_number: '',
      bsb: '',
      bank_name: '',
      account_type: 'checking',
      feed_provider: 'manual',
      is_active: true,
    },
  });

  useEffect(() => {
    if (mode === 'edit' && account) {
      form.reset({
        account_name: account.account_name,
        account_number: account.account_number,
        bsb: account.bsb,
        bank_name: account.bank_name,
        account_type: account.account_type,
        feed_provider: account.feed_provider,
        is_active: account.is_active,
      });
    } else {
      form.reset({
        account_name: '',
        account_number: '',
        bsb: '',
        bank_name: '',
        account_type: 'checking',
        feed_provider: 'manual',
        is_active: true,
      });
    }
  }, [mode, account, form]);

  async function onSubmit(data: BankAccountFormData) {
    setIsLoading(true);
    try {
      if (mode === 'create') {
        await createBankAccount(data as BankAccountCreateData);
        toast({
          title: 'Success',
          description: 'Bank account created successfully',
        });
      } else if (account) {
        await updateBankAccount(account.id, data as BankAccountUpdateData);
        toast({
          title: 'Success',
          description: 'Bank account updated successfully',
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save bank account',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Bank Account' : 'Edit Bank Account'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new bank account for reconciliation'
              : 'Update bank account information'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="account_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="ANZ Business Account" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="ANZ" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bsb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BSB *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123-456"
                        {...field}
                        onChange={(e) => {
                          let value = e.target.value.replace(/[^0-9-]/g, '');
                          if (value.length === 3 && !value.includes('-')) {
                            value = value + '-';
                          }
                          field.onChange(value);
                        }}
                        maxLength={7}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="account_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567890" {...field} />
                  </FormControl>
                  <FormDescription>Full account number (will be masked in display)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="feed_provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feed Provider *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="xero">Xero</SelectItem>
                        <SelectItem value="yodlee">Yodlee</SelectItem>
                        <SelectItem value="basiq">Basiq (CDR)</SelectItem>
                        <SelectItem value="cdr">CDR / Open Banking</SelectItem>
                        <SelectItem value="manual">Manual / CSV</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Account can sync bank feeds and reconcile transactions
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
                {isLoading ? 'Saving...' : mode === 'create' ? 'Create Account' : 'Update Account'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
