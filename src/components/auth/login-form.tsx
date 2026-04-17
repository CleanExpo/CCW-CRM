'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Link from 'next/link';
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
import { Checkbox } from '@/components/ui/checkbox';
import { authApi } from '@/lib/api/auth';
import toast from 'react-hot-toast';

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

export interface LoginFormProps {
  /** High-contrast styling for the marketing homepage dark shell. */
  variant?: 'default' | 'marketing';
}

export function LoginForm({ variant = 'default' }: LoginFormProps) {
  const isMarketing = variant === 'marketing';
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);

    try {
      const response = await authApi.login({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      });

      toast.success(`Signed in — welcome back, ${response.user.email}`);

      // Force full page reload to trigger middleware authentication check
      // This ensures the auth cookie is properly validated server-side
      window.location.replace('/dashboard');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid email or password';
      toast.error(errorMessage, { id: 'login-error' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={isMarketing ? 'space-y-5' : 'space-y-4'}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={isMarketing ? 'text-sm font-semibold text-zinc-200' : undefined}>
                Email
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  className={
                    isMarketing
                      ? 'h-12 rounded-xl border-zinc-600 bg-zinc-900/90 text-zinc-50 shadow-inner shadow-black/30 placeholder:text-zinc-500 focus-visible:border-sky-500/70 focus-visible:ring-2 focus-visible:ring-sky-500/35'
                      : undefined
                  }
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
              <FormLabel className={isMarketing ? 'text-sm font-semibold text-zinc-200' : undefined}>
                Password
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={
                    isMarketing
                      ? 'h-12 rounded-xl border-zinc-600 bg-zinc-900/90 text-zinc-50 shadow-inner shadow-black/30 placeholder:text-zinc-500 focus-visible:border-sky-500/70 focus-visible:ring-2 focus-visible:ring-sky-500/35'
                      : undefined
                  }
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem
              className={
                isMarketing
                  ? 'flex items-center gap-3 space-y-0 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5'
                  : 'flex items-center gap-2 space-y-0'
              }
            >
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className={
                    isMarketing
                      ? 'h-5 w-5 border-zinc-500 data-[state=checked]:border-transparent data-[state=checked]:bg-gradient-brand data-[state=checked]:text-white'
                      : undefined
                  }
                />
              </FormControl>
              <FormLabel
                className={
                  isMarketing
                    ? 'cursor-pointer text-sm font-medium leading-snug text-zinc-300'
                    : 'cursor-pointer text-sm font-normal'
                }
              >
                Keep me signed in
              </FormLabel>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          variant={isMarketing ? 'gradient' : 'default'}
          size={isMarketing ? 'lg' : 'default'}
          className={
            isMarketing
              ? 'mt-1 h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg shadow-indigo-500/30 hover:brightness-110'
              : 'w-full'
          }
          disabled={isLoading}
          rightIcon={isMarketing && !isLoading ? <ArrowRight className="h-4 w-4 opacity-90" /> : undefined}
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>

        <div
          className={
            isMarketing
              ? 'mt-5 flex flex-col gap-3 text-center text-xs text-zinc-500'
              : 'mt-4 flex flex-col gap-2 text-center text-xs text-slate-400'
          }
        >
          <p className={isMarketing ? 'text-zinc-400' : undefined}>
            <Link
              href="/register"
              className={
                isMarketing
                  ? 'font-medium text-sky-300 underline-offset-4 transition-colors hover:text-sky-200 hover:underline'
                  : 'font-medium text-primary hover:underline'
              }
            >
              Create an account
            </Link>
            <span className={isMarketing ? 'text-zinc-600' : 'text-muted-foreground'}> · </span>
            <Link
              href="/forgot-password"
              className={
                isMarketing
                  ? 'font-medium text-zinc-400 underline-offset-4 transition-colors hover:text-sky-300 hover:underline'
                  : 'hover:text-slate-600 hover:underline'
              }
            >
              Forgot password?
            </Link>
          </p>
        </div>
      </form>
    </Form>
  );
}
