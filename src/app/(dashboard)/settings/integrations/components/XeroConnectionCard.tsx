'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { AlertCircle, CheckCircle2, XCircle, ExternalLink, Unplug, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { startXeroAuth, disconnectXero, type XeroConnectionStatus } from '@/lib/api/xero';

interface XeroConnectionCardProps {
  status: XeroConnectionStatus | null;
  loading: boolean;
  onStatusChange: () => void;
}

export function XeroConnectionCard({ status, loading, onStatusChange }: XeroConnectionCardProps) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const authResponse = await startXeroAuth();

      if (authResponse.mode === 'demo') {
        toast({ title: 'Connected to Xero', description: 'Xero integration is now active.' });
        onStatusChange();
      } else if (authResponse.authorization_url) {
        window.location.href = authResponse.authorization_url;
      } else {
        throw new Error('No authorization URL returned from server.');
      }
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to start Xero authorization',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectXero();
      toast({
        title: 'Disconnected',
        description: 'Xero integration has been disconnected',
      });
      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Disconnection Failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect Xero',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
              <svg
                viewBox="0 0 24 24"
                className="fill-primary h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.341 14.887c-1.309 0-2.134-.877-2.134-2.134 0-1.258.825-2.134 2.134-2.134 1.309 0 2.134.876 2.134 2.134 0 1.257-.825 2.134-2.134 2.134zm-4.536 3.096c-1.551 0-2.617-1.066-2.617-2.617 0-1.55 1.066-2.616 2.617-2.616s2.616 1.066 2.616 2.616c0 1.551-1.065 2.617-2.616 2.617zm-8.27-3.096c-1.309 0-2.134-.877-2.134-2.134 0-1.258.825-2.134 2.134-2.134 1.309 0 2.134.876 2.134 2.134 0 1.257-.825 2.134-2.134 2.134zm4.536-7.632c-1.551 0-2.617-1.066-2.617-2.617 0-1.55 1.066-2.616 2.617-2.616s2.616 1.066 2.616 2.616c0 1.551-1.065 2.617-2.616 2.617z" />
              </svg>
            </div>
            <div>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-1 h-4 w-32" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.connected ?? false;
  const isNotConfigured = !status || status.mode === 'not_configured';
  const oauthRedirectUri = status?.oauth_redirect_uri;
  const registeredRedirectUris = status?.registered_redirect_uris ?? [];
  const showRedirectUrls = Boolean(oauthRedirectUri) || registeredRedirectUris.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
              <svg
                viewBox="0 0 24 24"
                className="fill-primary h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.341 14.887c-1.309 0-2.134-.877-2.134-2.134 0-1.258.825-2.134 2.134-2.134 1.309 0 2.134.876 2.134 2.134 0 1.257-.825 2.134-2.134 2.134zm-4.536 3.096c-1.551 0-2.617-1.066-2.617-2.617 0-1.55 1.066-2.616 2.617-2.616s2.616 1.066 2.616 2.616c0 1.551-1.065 2.617-2.616 2.617zm-8.27-3.096c-1.309 0-2.134-.877-2.134-2.134 0-1.258.825-2.134 2.134-2.134 1.309 0 2.134.876 2.134 2.134 0 1.257-.825 2.134-2.134 2.134zm4.536-7.632c-1.551 0-2.617-1.066-2.617-2.617 0-1.55 1.066-2.616 2.617-2.616s2.616 1.066 2.616 2.616c0 1.551-1.065 2.617-2.616 2.617z" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg">Xero Accounting</CardTitle>
              <CardDescription>Sync invoices and payments</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
        {isConnected && status?.tenant_name && (
          <div className="bg-muted rounded-lg p-3">
            <p className="text-muted-foreground text-sm">Connected to</p>
            <p className="font-medium">{status.tenant_name}</p>
          </div>
        )}

        {isNotConfigured && (
          <div className="border-muted-foreground/20 bg-muted/50 flex items-start gap-2 rounded-lg border p-3">
            <AlertCircle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-muted-foreground text-sm">
              <p className="font-medium">Integration not available</p>
              <p className="mt-1 text-xs">
                {status?.message ??
                  'Xero OAuth is not configured on the server yet (missing env vars or status could not be loaded).'}
              </p>
              {!status && (
                <p className="mt-1 text-xs">
                  If you are the administrator, check server env and that your user belongs to a workspace,
                  then restart the dev server.
                </p>
              )}
              {status?.mode === 'not_configured' && (
                <p className="mt-1 text-xs">
                  Set <code className="text-foreground">XERO_CLIENT_ID</code>,{' '}
                  <code className="text-foreground">XERO_CLIENT_SECRET</code>,{' '}
                  <code className="text-foreground">XERO_MODE=live</code>, and at least one of{' '}
                  <code className="text-foreground">XERO_REDIRECT_URI</code> /{' '}
                  <code className="text-foreground">XERO_REDIRECT_URI_LOCAL</code>, then restart the app.
                </p>
              )}
            </div>
          </div>
        )}

        {status?.message && !isConnected && !isNotConfigured && (
          <p className="text-muted-foreground text-sm">{status.message}</p>
        )}

        {showRedirectUrls && (
          <div className="border-muted-foreground/20 bg-muted/50 space-y-2 rounded-lg border p-3 text-xs">
            <p className="text-foreground font-medium">OAuth redirect URLs</p>
            {oauthRedirectUri ? (
              <p className="text-muted-foreground">
                <span className="text-foreground/80">This session uses:</span>{' '}
                <code className="text-foreground break-all">{oauthRedirectUri}</code>
              </p>
            ) : null}
            {registeredRedirectUris.length > 0 ? (
              <div className="text-muted-foreground space-y-1">
                <p className="text-foreground/80">Register each in Xero Developer Portal → Redirect URIs:</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {registeredRedirectUris.map((uri) => (
                    <li key={uri}>
                      <code className="text-foreground break-all">{uri}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-muted-foreground">
              <a
                href="https://developer.xero.com/app/manage"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Open Xero app settings
              </a>
            </p>
          </div>
        )}

        {status?.setup_steps && status.setup_steps.length > 0 && !isConnected && (
          <ul className="text-muted-foreground space-y-1.5 text-xs">
            {status.setup_steps.map((step) => (
              <li key={step.id} className="flex items-start gap-2">
                {step.done ? (
                  <CheckCircle2 className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className={step.done ? 'line-through opacity-70' : ''}>{step.label}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                onClick={onStatusChange}
                disabled={disconnecting}
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Status
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={disconnecting}>
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Xero?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will disconnect your Xero integration. You'll need to re-authorize to
                      sync invoices and payments again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={connecting || isNotConfigured}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {connecting ? 'Connecting...' : 'Connect to Xero'}
            </Button>
          )}
        </div>

        {!isConnected && !isNotConfigured && (
          <div className="border-muted bg-muted/50 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">
              <strong>What happens when you connect:</strong>
              <br />• Orders will sync to Xero as invoices
              <br />• Payments will update order status automatically
              <br />• Customers will sync to Xero contacts
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
