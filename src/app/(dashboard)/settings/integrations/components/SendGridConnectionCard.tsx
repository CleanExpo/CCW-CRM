'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle, CheckCircle2, KeyRound, Mail, RefreshCw, XCircle } from 'lucide-react';
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
import { type SendGridConnectionStatus, configureSendGrid } from '@/lib/api/sendgrid';

const configureSchema = z.object({
  api_key: z
    .string()
    .min(1, 'API key is required')
    .startsWith('SG.', { message: 'SendGrid API keys start with SG.' }),
  from_email: z.string().email('Enter a valid email').or(z.literal('')),
  from_name: z.string().optional(),
});

type ConfigureFormValues = z.infer<typeof configureSchema>;

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
  const [editingCredentials, setEditingCredentials] = useState(false);

  const isConnected = status?.connected ?? false;
  const isDemo = status?.mode === 'demo';
  const isNotConfigured = !status || status.mode === 'not_configured';
  const showForm = isNotConfigured || editingCredentials;

  const form = useForm<ConfigureFormValues>({
    resolver: zodResolver(configureSchema),
    defaultValues: { api_key: '', from_email: '', from_name: '' },
  });

  const handleSave = async (values: ConfigureFormValues) => {
    setSaving(true);
    try {
      await configureSendGrid({
        api_key: values.api_key,
        from_email: values.from_email || undefined,
        from_name: values.from_name || undefined,
      });
      toast({ title: 'SendGrid Configured', description: 'Email integration is now active' });
      setEditingCredentials(false);
      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save credentials',
      });
    } finally {
      setSaving(false);
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
              <Mail className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">SendGrid Email</CardTitle>
              <CardDescription>Email management &amp; AI responses</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <Badge variant="secondary" className="text-xs">
                Demo Mode
              </Badge>
            )}
            {isConnected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <XCircle className="h-3 w-3" />
                {isNotConfigured ? 'Not Configured' : 'Disconnected'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Connected state ── */}
        {isConnected && !editingCredentials && (
          <>
            <div className="bg-muted space-y-2 rounded-lg p-3">
              {status?.from_email && (
                <div>
                  <p className="text-muted-foreground text-sm">Sending from</p>
                  <p className="font-medium">{status.from_email}</p>
                  {status.from_name && (
                    <p className="text-muted-foreground text-sm">{status.from_name}</p>
                  )}
                </div>
              )}
              {status?.ai_auto_response_enabled !== undefined && (
                <div className="border-t pt-2">
                  <p className="text-muted-foreground text-sm">AI Auto-Response</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={status.ai_auto_response_enabled ? 'default' : 'secondary'}>
                      {status.ai_auto_response_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    {status.ai_auto_response_enabled && status.ai_confidence_threshold && (
                      <span className="text-muted-foreground text-xs">
                        Confidence ≥ {Math.round(status.ai_confidence_threshold * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
              {isDemo && (
                <p className="text-muted-foreground mt-1 border-t pt-2 text-xs">
                  Demo mode — no real emails are sent
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onStatusChange} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Status
              </Button>
              {!isDemo && (
                <Button variant="outline" onClick={() => setEditingCredentials(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Edit API Key
                </Button>
              )}
              <Button asChild className="flex-1">
                <Link href="/dashboard/finance/emails">
                  <Mail className="mr-2 h-4 w-4" />
                  Manage Emails
                </Link>
              </Button>
            </div>
          </>
        )}

        {/* ── Credential form ── */}
        {showForm && (
          <>
            {isNotConfigured && (
              <div className="border-muted-foreground/20 bg-muted/50 flex items-start gap-2 rounded-lg border p-3">
                <AlertCircle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-muted-foreground text-sm">
                  <p className="font-medium">Enter your SendGrid API key</p>
                  <p className="mt-1 text-xs">
                    Create a key at sendgrid.com → Settings → API Keys with Full Access.
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
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="SG.xxxxxxxxxx..."
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
                        From Email <span className="text-muted-foreground">(optional)</span>
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
                        From Name <span className="text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Your Business Name" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? 'Saving...' : 'Save API Key'}
                  </Button>
                  {editingCredentials && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingCredentials(false)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>

            {isNotConfigured && (
              <div className="border-muted bg-muted/50 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">
                  <strong>Features unlocked:</strong>
                  <br />• Transactional email sending
                  <br />• Inbound email processing
                  <br />• AI-powered classification &amp; responses
                  <br />• Conversation threading &amp; tracking
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
