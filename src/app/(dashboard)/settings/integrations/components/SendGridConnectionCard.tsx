'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Mail,
  RefreshCw,
  Unplug,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  type SendGridConnectionStatus,
  configureSendGrid,
  disconnectSendGrid,
} from '@/lib/api/sendgrid';

interface SendGridConnectionCardProps {
  status: SendGridConnectionStatus | null;
  loading: boolean;
  onStatusChange: () => void;
}

export function SendGridConnectionCard({
  status,
  loading,
  onStatusChange,
}: SendGridConnectionCardProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState(false);

  const environmentKeyConfigured = status?.environment_key_configured ?? false;

  const configureSchema = useMemo(
    () =>
      z
        .object({
          api_key: z.string().optional(),
          from_email: z.union([z.literal(''), z.string().email('Enter a valid email')]),
          from_name: z.string().optional(),
        })
        .superRefine((data, ctx) => {
          const key = data.api_key?.trim() ?? '';
          if (!environmentKeyConfigured && !key) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                'API key is required unless SENDGRID_API_KEY is set on the server for shared testing.',
              path: ['api_key'],
            });
          }
          if (key && !key.startsWith('SG.')) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'SendGrid API keys start with SG.',
              path: ['api_key'],
            });
          }
        }),
    [environmentKeyConfigured]
  );

  type ConfigureFormValues = z.infer<typeof configureSchema>;

  const canSend = status?.can_send ?? status?.connected ?? false;
  const isConfigured = Boolean(status?.connected) || status?.mode === 'demo';
  const isNotConfigured = !status || status.mode === 'not_configured';
  const showForm = isNotConfigured || editingCredentials;
  const apiVerified = status?.api_verified;
  const browserOverrides = status?.browser_overrides_active ?? false;

  const form = useForm<ConfigureFormValues>({
    resolver: zodResolver(configureSchema),
    defaultValues: { api_key: '', from_email: '', from_name: '' },
  });

  useEffect(() => {
    form.reset({
      api_key: '',
      from_email: status?.from_email ?? '',
      from_name: status?.from_name ?? '',
    });
  }, [status?.from_email, status?.from_name, form]);

  const handleSave = async (values: ConfigureFormValues) => {
    setSaving(true);
    try {
      const payload: Parameters<typeof configureSendGrid>[0] = {};
      const key = values.api_key?.trim();
      if (key) payload.api_key = key;
      if (values.from_email?.trim()) payload.from_email = values.from_email.trim();
      if (values.from_name?.trim()) payload.from_name = values.from_name.trim();

      await configureSendGrid(payload);
      toast({ title: 'SendGrid updated', description: 'Integration settings were saved.' });
      setEditingCredentials(false);
      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearOverrides = async () => {
    setClearing(true);
    try {
      await disconnectSendGrid();
      toast({
        title: 'Browser overrides cleared',
        description: 'Using server environment SendGrid settings again.',
      });
      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Clear failed',
        description: error instanceof Error ? error.message : 'Could not clear cookies',
      });
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
              <Mail className="text-primary h-6 w-6" />
            </div>
            <div>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-1 h-4 w-40" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
              <Mail className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">SendGrid Email</CardTitle>
              <CardDescription>Transactional email &amp; conversation tooling</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isConfigured && apiVerified === false && status?.mode === 'live' && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Key not verified
              </Badge>
            )}
            {canSend ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <XCircle className="h-3 w-3" />
                {isNotConfigured ? 'Not configured' : 'Disconnected'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status?.message && (
          <p className="text-muted-foreground text-sm">{status.message}</p>
        )}

        {isConfigured && environmentKeyConfigured && status?.api_key_source === 'environment' && (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100/90">
            Using <strong className="font-medium">server</strong> SendGrid credentials (
            <code className="text-xs">SENDGRID_API_KEY</code>). You can still override From details
            below or paste a different key for this browser only.
          </div>
        )}

        {isConfigured && !status?.from_email && status?.mode !== 'demo' && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              No verified sender email is set. Outbound send will fail until you set{' '}
              <code className="rounded bg-black/5 px-1 text-xs dark:bg-white/10">SENDGRID_FROM_EMAIL</code>{' '}
              on the server or save a From email here.
            </span>
          </div>
        )}

        {isConfigured && !editingCredentials && (
          <>
            <div className="bg-muted space-y-2 rounded-lg p-3">
              {status?.from_email ? (
                <div>
                  <p className="text-muted-foreground text-sm">Sending from</p>
                  <p className="font-medium">{status.from_email}</p>
                  {status.from_name ? (
                    <p className="text-muted-foreground text-sm">{status.from_name}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No From address configured yet.</p>
              )}
              {status?.api_key_source && (
                <p className="text-muted-foreground text-xs">
                  API key source:{' '}
                  <span className="text-foreground font-medium">{status.api_key_source}</span>
                </p>
              )}
              {status?.ai_auto_response_enabled !== undefined && (
                <div className="border-t pt-2">
                  <p className="text-muted-foreground text-sm">AI auto-response</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={status.ai_auto_response_enabled ? 'default' : 'secondary'}>
                      {status.ai_auto_response_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    {status.ai_auto_response_enabled && status.ai_confidence_threshold != null && (
                      <span className="text-muted-foreground text-xs">
                        Confidence ≥ {Math.round(Number(status.ai_confidence_threshold) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void onStatusChange()} className="min-w-0 flex-1">
                <RefreshCw className="mr-2 h-4 w-4 shrink-0" />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => setEditingCredentials(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button asChild className="min-w-0 flex-1">
                <Link href="/dashboard/finance/emails">
                  <Mail className="mr-2 h-4 w-4 shrink-0" />
                  Emails
                </Link>
              </Button>
            </div>

            {browserOverrides && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed"
                disabled={clearing}
                onClick={() => void handleClearOverrides()}
              >
                <Unplug className="mr-2 h-4 w-4" />
                {clearing ? 'Clearing…' : 'Clear saved browser overrides'}
              </Button>
            )}
          </>
        )}

        {showForm && (
          <>
            {isNotConfigured && (
              <div className="border-muted-foreground/20 bg-muted/50 flex items-start gap-2 rounded-lg border p-3">
                <AlertCircle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-muted-foreground text-sm">
                  <p className="font-medium">Connect SendGrid</p>
                  <p className="mt-1 text-xs">
                    Prefer shared testing: ask your host to set{' '}
                    <code className="bg-muted rounded px-1">SENDGRID_API_KEY</code> and a verified{' '}
                    <code className="bg-muted rounded px-1">SENDGRID_FROM_EMAIL</code> on the server.
                    Otherwise paste an API key from SendGrid → Settings → API Keys.
                  </p>
                </div>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="api_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        API key{' '}
                        {environmentKeyConfigured ? (
                          <span className="text-muted-foreground font-normal">(optional)</span>
                        ) : null}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={
                            environmentKeyConfigured
                              ? 'Leave blank to keep server key'
                              : 'SG.xxxxxxxxxx…'
                          }
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
                  name="from_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        From email <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="noreply@yourdomain.com" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="from_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        From name <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Your business name" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                  {editingCredentials && (
                    <Button type="button" variant="outline" onClick={() => setEditingCredentials(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>

            {isNotConfigured && (
              <div className="border-muted bg-muted/50 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">
                  <strong className="text-foreground">Unlocked:</strong> transactional send, finance email
                  UI, and (when wired) inbound events. Replace with your own SendGrid account when
                  provisioning is ready.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
