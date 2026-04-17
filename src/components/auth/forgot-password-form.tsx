'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api/auth';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type FormData = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      const res = await authApi.requestPasswordReset(values.email);
      toast({
        title: 'Check your email',
        description: res.message,
      });
      setSent(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      toast({
        variant: 'destructive',
        title: 'Request failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass =
    'h-12 rounded-xl border-zinc-600 bg-zinc-900/90 text-zinc-50 shadow-inner shadow-black/30 placeholder:text-zinc-500 focus-visible:border-sky-500/70 focus-visible:ring-2 focus-visible:ring-sky-500/35';
  const labelClass = 'text-sm font-semibold text-zinc-200';

  if (sent) {
    return (
      <div className="space-y-4 text-center text-sm text-zinc-300">
        <p>If an account exists for that address, we sent reset instructions.</p>
        <Button asChild variant="outline" className="border-zinc-600 bg-zinc-900/50 text-zinc-100 hover:bg-zinc-800">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClass}>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className={inputClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="gradient"
          size="lg"
          className="h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg shadow-indigo-500/30 hover:brightness-110"
          disabled={isLoading}
        >
          {isLoading ? 'Sending…' : 'Send reset link'}
        </Button>
        <p className="text-center text-xs text-zinc-500">
          <Link
            href="/login"
            className="font-medium text-zinc-400 underline-offset-4 transition-colors hover:text-sky-300 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </Form>
  );
}
