'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ArrowRight } from 'lucide-react';
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
import toast from 'react-hot-toast';

const formSchema = z
  .object({
    full_name: z.string().min(1, 'Name is required').max(120),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm: z.string().min(6, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type FormData = z.infer<typeof formSchema>;

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm: '',
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      const response = await authApi.register({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
      });

      toast.success(response.message || `Account created — welcome, ${response.user.email}`);

      if (response.access_token) {
        window.location.href = '/settings/welcome?from=register';
      } else {
        window.location.href = '/login?registered=1';
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Could not create account';
      toast.error(errorMessage, { id: 'register-error' });
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass =
    'h-12 rounded-xl border-zinc-600 bg-zinc-900/95 text-zinc-50 shadow-inner shadow-black/30 placeholder:text-zinc-500 focus-visible:border-sky-500/70 focus-visible:ring-2 focus-visible:ring-sky-500/35';
  const labelClass = 'text-sm font-semibold text-zinc-200';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-xl border border-white/[0.09] bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-violet-500/10 px-3.5 py-2.5 text-center text-xs font-medium text-zinc-300">
          Start with your team profile now, add company details after sign in.
        </div>
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClass}>Full name</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="name"
                  placeholder="Alex Supplier"
                  className={inputClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClass}>Work email</FormLabel>
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClass}>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className={inputClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelClass}>Confirm password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat password"
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
          className="mt-1 h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg shadow-indigo-500/30 hover:brightness-110"
          disabled={isLoading}
          rightIcon={!isLoading ? <ArrowRight className="h-4 w-4 opacity-90" /> : undefined}
        >
          {isLoading ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-center text-xs text-zinc-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-zinc-400 underline-offset-4 transition-colors hover:text-sky-300 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  );
}
