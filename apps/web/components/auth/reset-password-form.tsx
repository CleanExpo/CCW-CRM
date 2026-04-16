'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useToast } from '@/hooks/use-toast';

const formSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type FormData = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase sends the recovery token in the URL hash as #access_token=...&type=recovery
  // We must wait for the client to parse it via onAuthStateChange
  useEffect(() => {
    async function waitForSession() {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );

      // Check if we already have a valid recovery session
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
        return;
      }

      // Wait for the PASSWORD_RECOVERY event from the hash token
      const { data: listener } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setReady(true);
        }
      });

      // Timeout: if no recovery event within 5s the link is stale
      const timeout = setTimeout(() => {
        setError('This reset link has expired or already been used. Please request a new one.');
      }, 5000);

      return () => {
        listener.subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }

    waitForSession();
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirm: '' },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );

      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (updateError) throw new Error(updateError.message);

      setDone(true);
      toast({
        title: 'Password updated',
        description: 'You can now sign in with your new password.',
      });

      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsLoading(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push('/forgot-password')}
        >
          Request a new link
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">✅</div>
        <h2 className="text-lg font-semibold">Password updated</h2>
        <p className="text-muted-foreground text-sm">Redirecting you to sign in...</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
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
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Set New Password'}
        </Button>
      </form>
    </Form>
  );
}
