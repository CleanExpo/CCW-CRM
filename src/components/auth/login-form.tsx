'use client';

import { AuthHotToaster } from '@/components/auth/auth-hot-toaster';
import { MfaEnrollPanel } from '@/components/auth/mfa-enroll-panel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import * as z from 'zod';

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

type MfaStep =
  | { kind: 'none' }
  | { kind: 'verify'; mfa_token: string; email: string; rememberMe: boolean }
  | {
      kind: 'enroll';
      mfa_token: string;
      email: string;
      rememberMe: boolean;
      secret?: string;
      otpauth_uri?: string;
      recovery_codes?: string[];
    };

export interface LoginFormProps {
  /** High-contrast styling for the marketing homepage dark shell. */
  variant?: 'default' | 'marketing';
}

export function LoginForm({ variant = 'default' }: LoginFormProps) {
  const isMarketing = variant === 'marketing';
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState<MfaStep>({ kind: 'none' });
  const [mfaCode, setMfaCode] = useState('');

  function safeRedirectPath(raw: string | null): string {
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
    return raw;
  }

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  async function finishSignIn(email: string) {
    toast.success(`Signed in — welcome back, ${email}`);
    const redirectTo = safeRedirectPath(searchParams.get('redirect'));
    window.location.replace(redirectTo);
  }

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      const response = await authApi.login({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      });

      if (response.mfa_required && response.mfa_token) {
        setMfaStep({
          kind: 'verify',
          mfa_token: response.mfa_token,
          email: values.email,
          rememberMe: values.rememberMe,
        });
        toast.success('Enter the code from your authenticator app');
        return;
      }

      if (response.mfa_enrollment_required && response.mfa_token) {
        const setup = await authApi.setupMfa(response.mfa_token);
        setMfaStep({
          kind: 'enroll',
          mfa_token: response.mfa_token,
          email: values.email,
          rememberMe: values.rememberMe,
          secret: setup.secret,
          otpauth_uri: setup.otpauth_uri,
          recovery_codes: setup.recovery_codes,
        });
        toast.success('Set up your authenticator app to continue');
        return;
      }

      if (!response.access_token || !response.user) {
        throw new Error(response.detail || 'Sign-in incomplete');
      }
      await finishSignIn(response.user.email);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid email or password';
      toast.error(errorMessage, { id: 'login-error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function onVerifyMfa() {
    if (mfaStep.kind !== 'verify') return;
    setIsLoading(true);
    try {
      const response = await authApi.verifyMfa({
        mfa_token: mfaStep.mfa_token,
        code: mfaCode,
        rememberMe: mfaStep.rememberMe,
      });
      if (!response.user) throw new Error('MFA verification incomplete');
      await finishSignIn(response.user.email);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Invalid MFA code', {
        id: 'mfa-error',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onConfirmEnroll() {
    if (mfaStep.kind !== 'enroll') return;
    setIsLoading(true);
    try {
      const response = await authApi.confirmMfa({
        mfa_token: mfaStep.mfa_token,
        code: mfaCode,
        rememberMe: mfaStep.rememberMe,
      });
      if (!response.user) throw new Error('MFA enrollment incomplete');
      await finishSignIn(response.user.email);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Invalid authenticator code', {
        id: 'mfa-error',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (mfaStep.kind === 'verify') {
    return (
      <>
        <AuthHotToaster />
        <div className={isMarketing ? 'space-y-5' : 'space-y-4'}>
          <p className={isMarketing ? 'text-sm text-zinc-300' : 'text-muted-foreground text-sm'}>
            Enter the 6-digit code from your authenticator app, or a recovery code.
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            className={
              isMarketing
                ? 'h-12 rounded-xl border-zinc-600 bg-zinc-900/95 text-zinc-50'
                : undefined
            }
          />
          <Button
            className="w-full"
            disabled={isLoading || mfaCode.trim().length < 4}
            onClick={() => void onVerifyMfa()}
          >
            {isLoading ? 'Verifying…' : 'Verify and sign in'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setMfaStep({ kind: 'none' });
              setMfaCode('');
            }}
          >
            Back to password
          </Button>
        </div>
      </>
    );
  }

  if (mfaStep.kind === 'enroll') {
    return (
      <>
        <AuthHotToaster />
        <MfaEnrollPanel
          variant={isMarketing ? 'marketing' : 'default'}
          secret={mfaStep.secret}
          otpauthUri={mfaStep.otpauth_uri}
          recoveryCodes={mfaStep.recovery_codes}
          code={mfaCode}
          onCodeChange={setMfaCode}
          onConfirm={() => void onConfirmEnroll()}
          busy={isLoading}
          confirmLabel="Enable MFA and sign in"
        />
      </>
    );
  }

  return (
    <>
      <AuthHotToaster />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={isMarketing ? 'space-y-5' : 'space-y-4'}
        >
          {isMarketing ? (
            <div className="rounded-xl border border-white/[0.09] bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-violet-500/10 px-3.5 py-2.5 text-center text-xs font-medium text-zinc-300">
              Use your work credentials to continue to CCW Online.
            </div>
          ) : null}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  className={isMarketing ? 'text-sm font-semibold text-zinc-200' : undefined}
                >
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    className={
                      isMarketing
                        ? 'h-12 rounded-xl border-zinc-600 bg-zinc-900/95 text-zinc-50 shadow-inner shadow-black/30 placeholder:text-zinc-500 focus-visible:border-sky-500/70 focus-visible:ring-2 focus-visible:ring-sky-500/35'
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
                <FormLabel
                  className={isMarketing ? 'text-sm font-semibold text-zinc-200' : undefined}
                >
                  Password
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={
                      isMarketing
                        ? 'h-12 rounded-xl border-zinc-600 bg-zinc-900/95 text-zinc-50 shadow-inner shadow-black/30 placeholder:text-zinc-500 focus-visible:border-sky-500/70 focus-visible:ring-2 focus-visible:ring-sky-500/35'
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
                        ? 'data-[state=checked]:bg-gradient-brand h-5 w-5 border-zinc-500 data-[state=checked]:border-transparent data-[state=checked]:text-white'
                        : undefined
                    }
                  />
                </FormControl>
                <FormLabel
                  className={
                    isMarketing
                      ? 'cursor-pointer text-sm leading-snug font-medium text-zinc-300'
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
            rightIcon={
              isMarketing && !isLoading ? <ArrowRight className="h-4 w-4 opacity-90" /> : undefined
            }
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
    </>
  );
}
