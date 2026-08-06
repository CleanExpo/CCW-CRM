'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Unplug,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import type { Cin7ConnectionStatus } from '@/lib/api/cin7';
import { configureCin7, connectCin7, disconnectCin7 } from '@/lib/api/cin7';

const configureSchema = z
  .object({
    core_account_id: z.string().optional(),
    core_application_key: z.string().optional(),
    omni_username: z.string().optional(),
    omni_api_key: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const coreId = data.core_account_id?.trim() ?? '';
    const coreKey = data.core_application_key?.trim() ?? '';
    const omniUser = data.omni_username?.trim() ?? '';
    const omniKey = data.omni_api_key?.trim() ?? '';
    const coreComplete = Boolean(coreId && coreKey);
    const omniComplete = Boolean(omniUser && omniKey);
    if (!coreComplete && !omniComplete) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide Cin7 Omni (API username + connection key) and/or Cin7 Core (Account ID + application key).',
      });
    }
    if (coreId && !coreKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['core_application_key'],
        message: 'Application Key is required when Account ID is set.',
      });
    }
    if (!coreId && coreKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['core_account_id'],
        message: 'Account ID is required when Application Key is set.',
      });
    }
    if (omniUser && !omniKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['omni_api_key'],
        message: 'Connection key is required when API username is set.',
      });
    }
    if (!omniUser && omniKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['omni_username'],
        message: 'API username is required when connection key is set.',
      });
    }
  });

type ConfigureFormValues = z.infer<typeof configureSchema>;

interface Cin7ConnectionCardProps {
  status: Cin7ConnectionStatus | null;
  loading: boolean;
  onStatusChange: (options?: { verify?: boolean }) => void | Promise<unknown>;
}

export function Cin7ConnectionCard({ status, loading, onStatusChange }: Cin7ConnectionCardProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showOmni, setShowOmni] = useState(true);
  const [showCore, setShowCore] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState(false);

  const isConnected = status?.connected ?? false;
  const isNotConfigured = !status || status.mode === 'not_configured';
  const showForm = isNotConfigured || editingCredentials;
  const needsConnect =
    !isConnected &&
    !showForm &&
    status &&
    status.mode !== 'not_configured' &&
    (Boolean(status.omni_connected) || Boolean(status.core_connected));

  const form = useForm<ConfigureFormValues>({
    resolver: zodResolver(configureSchema),
    defaultValues: {
      core_account_id: '',
      core_application_key: '',
      omni_username: '',
      omni_api_key: '',
    },
  });

  const handleSave = async (values: ConfigureFormValues) => {
    setSaving(true);
    try {
      const payload: Parameters<typeof configureCin7>[0] = {};
      const cid = values.core_account_id?.trim();
      const ckey = values.core_application_key?.trim();
      const ou = values.omni_username?.trim();
      const ok = values.omni_api_key?.trim();
      if (cid && ckey) {
        payload.core_account_id = cid;
        payload.core_application_key = ckey;
      }
      if (ou && ok) {
        payload.omni_username = ou;
        payload.omni_api_key = ok;
      }
      await configureCin7(payload);
      try {
        await connectCin7();
        toast({
          title: 'Cin7 connected',
          description:
            'Credentials saved and Cin7 responded successfully. You can run sync from the controls below.',
        });
      } catch (connectErr: unknown) {
        toast({
          variant: 'destructive',
          title: 'Saved but not connected',
          description:
            connectErr instanceof Error
              ? connectErr.message
              : 'Credentials were saved; use Connect when Cin7 is reachable.',
        });
      }
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

  const handleConnect = async () => {
    try {
      await connectCin7();
      toast({
        title: 'Connected to Cin7',
        description: 'Cin7 integration connected',
      });
      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Cin7',
      });
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectCin7();
      toast({ title: 'Disconnected', description: 'Cin7 integration has been disconnected' });
      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Disconnect Failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect from Cin7',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Live-ping Cin7 only on explicit Refresh — page load uses the fast path.
      await onStatusChange({ verify: true });
      toast({ title: 'Status Refreshed', description: 'Live Cin7 connectivity checked.' });
    } catch {
      toast({ variant: 'destructive', title: 'Refresh Failed' });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-32" />
              <Skeleton className="h-4 w-48" />
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
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-indigo-600">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div>
              <CardTitle>Cin7 Inventory</CardTitle>
              <CardDescription>
                Pull products, customers, and orders from Cin7 Omni (read-only API).
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && Boolean(status?.core_connected) && (
              <Badge variant="outline" className="text-xs">
                Core
              </Badge>
            )}
            {isConnected && Boolean(status?.omni_connected) && (
              <Badge variant="outline" className="text-xs">
                Omni
              </Badge>
            )}
            {isConnected ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {isNotConfigured ? 'Not Configured' : 'Disconnected'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status?.core_connected &&
          status?.connector_allowlist &&
          status.connector_allowlist.length > 0 && (
            <div className="border-border/80 bg-muted/40 rounded-lg border p-3">
              <p className="text-sm font-medium">Cin7 Core API connector IPs</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Only applies to Cin7 Core. Omni uses username + connection key and does not require
                IP allowlisting.
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {status.connector_allowlist.map((c) => (
                  <li key={c.name}>
                    {c.name}: {c.ip}
                  </li>
                ))}
              </ul>
            </div>
          )}

        {needsConnect && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950">
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
              Ready to sync
            </p>
            <p className="text-muted-foreground mt-1 text-xs dark:text-indigo-200/90">
              {status?.message ??
                'Cin7 responded successfully. Click Connect to pull read-only data from Omni.'}
            </p>
            <Button className="mt-3" size="sm" onClick={handleConnect}>
              Connect
            </Button>
          </div>
        )}

        {/* ── Connected state ── */}
        {isConnected && !editingCredentials && (
          <>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                    Cin7 Integration Active
                  </p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    Inbound sync from Cin7 is enabled (Omni uses read-only GET calls to your live
                    tenant).
                  </p>
                </div>
              </div>
            </div>

            {status?.last_sync && (
              <div className="text-muted-foreground text-sm">
                Last sync: {new Date(status.last_sync).toLocaleString()}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>

              <Button variant="outline" size="sm" onClick={() => setEditingCredentials(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                Edit Credentials
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={disconnecting}>
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Cin7?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop product, inventory, and order sync with Cin7. Your credentials
                      will be preserved and you can reconnect at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}

        {/* ── Credential form (not configured OR editing) ── */}
        {showForm && (
          <>
            {!isNotConfigured && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  Updating your credentials will replace the existing connection.
                </p>
              </div>
            )}

            {isNotConfigured && (
              <div className="border-muted-foreground/20 bg-muted/50 flex items-start gap-2 rounded-lg border p-3">
                <AlertCircle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-muted-foreground text-sm">
                  <p className="font-medium">Cin7 Omni (recommended)</p>
                  <p className="mt-1 text-xs">
                    Use your <strong className="font-medium">API username</strong> and{' '}
                    <strong className="font-medium">connection key</strong> from Cin7. Read-only
                    Omni access is enough: we only call Cin7 GET endpoints and copy data into this
                    app. No IP allowlisting is required for Omni. You can also set{' '}
                    <code className="text-xs">CIN7_OMNI_USERNAME</code> and{' '}
                    <code className="text-xs">CIN7_OMNI_API_KEY</code> in{' '}
                    <code className="text-xs">.env.local</code>.
                  </p>
                </div>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                {/* Cin7 Omni — primary */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowOmni((v) => !v)}
                    className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-xs font-semibold tracking-wide uppercase"
                  >
                    <span>Cin7 Omni</span>
                    {showOmni ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {showOmni && (
                    <>
                      <FormField
                        control={form.control}
                        name="omni_username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API username</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Cin7 Omni API username"
                                autoComplete="off"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="omni_api_key"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Connection key</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Paste your Cin7 connection key"
                                autoComplete="new-password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                {/* Cin7 Core — optional */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowCore((v) => !v)}
                    className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-xs font-semibold tracking-wide uppercase"
                  >
                    <span>Cin7 Core (optional)</span>
                    {showCore ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {showCore && (
                    <>
                      <FormField
                        control={form.control}
                        name="core_account_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account ID</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Core / External API account ID"
                                autoComplete="off"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="core_application_key"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Application key</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Core application key"
                                autoComplete="new-password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {saving ? 'Connecting...' : 'Save & Connect'}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
