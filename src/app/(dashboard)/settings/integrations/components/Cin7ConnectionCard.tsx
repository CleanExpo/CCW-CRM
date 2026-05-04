'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
          'Provide Cin7 Core (Account ID + Application Key) and/or Cin7 Omni (Username + API Key).',
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
        message: 'Omni API Key is required when Username is set.',
      });
    }
    if (!omniUser && omniKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['omni_username'],
        message: 'Omni Username is required when API Key is set.',
      });
    }
  });

type ConfigureFormValues = z.infer<typeof configureSchema>;

interface Cin7ConnectionCardProps {
  status: Cin7ConnectionStatus | null;
  loading: boolean;
  onStatusChange: () => void;
}

export function Cin7ConnectionCard({ status, loading, onStatusChange }: Cin7ConnectionCardProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showOmni, setShowOmni] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState(false);

  const isConnected = status?.connected ?? false;
  const isNotConfigured = !status || status.mode === 'not_configured';
  const showForm = isNotConfigured || editingCredentials;

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
      toast({
        title: 'Credentials Saved',
        description: 'Cin7 integration is now active',
      });
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
      await onStatusChange();
      toast({ title: 'Status Refreshed' });
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
              <CardDescription>Sync products, orders &amp; stock</CardDescription>
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
        {status?.connector_allowlist && status.connector_allowlist.length > 0 && (
          <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
            <p className="text-sm font-medium">Cin7 API connector IPs</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Cin7 limits Core API access to registered connector IPs. Ensure these addresses are
              configured in Cin7 for the integrations that call Core from your network.
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
                    Connected to Cin7 inventory management
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
                  <p className="font-medium">Enter your Cin7 API credentials</p>
                  <p className="mt-1 text-xs">
                    Use <strong className="font-medium">Cin7 Core</strong> (Settings → API) and/or{' '}
                    <strong className="font-medium">Cin7 Omni</strong> (API username + connection key).
                    At least one complete pair is required.
                  </p>
                </div>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                {/* Cin7 Core credentials */}
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Cin7 Core (optional if using Omni)
                  </p>
                  <FormField
                    control={form.control}
                    name="core_account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 12345678-abcd-..."
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
                        <FormLabel>Application Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Paste your application key"
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Cin7 Omni credentials (collapsible) */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowOmni((v) => !v)}
                    className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-xs font-semibold tracking-wide uppercase"
                  >
                    <span>Cin7 Omni (optional if using Core)</span>
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
                            <FormLabel>Omni Username</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Cin7 Omni username"
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
                            <FormLabel>Omni API Key</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Paste your Omni API key"
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
                    {saving ? 'Saving...' : 'Save & Connect'}
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
              <>
                <Separator />
                <Button variant="ghost" size="sm" className="text-muted-foreground w-full" onClick={handleConnect}>
                  Connect
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
