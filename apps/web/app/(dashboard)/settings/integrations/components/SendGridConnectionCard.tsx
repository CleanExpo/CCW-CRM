"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Mail, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { type SendGridConnectionStatus } from "@/lib/api/sendgrid";
import Link from "next/link";

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
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
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

  const isConnected = status?.connected ?? false;
  const isDemo = status?.mode === "demo";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">SendGrid Email</CardTitle>
              <CardDescription>Email management & AI responses</CardDescription>
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
                Disconnected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && status && (
          <div className="rounded-lg bg-muted p-3 space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Sending from</p>
              <p className="font-medium">{status.from_email}</p>
              <p className="text-sm text-muted-foreground">{status.from_name}</p>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">AI Auto-Response</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={status.ai_auto_response_enabled ? "default" : "secondary"}>
                  {status.ai_auto_response_enabled ? "Enabled" : "Disabled"}
                </Badge>
                {status.ai_auto_response_enabled && (
                  <span className="text-xs text-muted-foreground">
                    Confidence ≥ {Math.round(status.ai_confidence_threshold * 100)}%
                  </span>
                )}
              </div>
            </div>
            {isDemo && (
              <p className="mt-1 text-xs text-muted-foreground border-t pt-2">
                Demo mode - No real emails are sent
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button variant="outline" onClick={onStatusChange} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Status
              </Button>
              <Button asChild className="flex-1">
                <Link href="/emails">
                  <Mail className="mr-2 h-4 w-4" />
                  Manage Emails
                </Link>
              </Button>
            </>
          ) : (
            <div className="w-full">
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Configure in environment
                </p>
                <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
                  Set SENDGRID_MODE, SENDGRID_API_KEY, and SENDGRID_FROM_EMAIL in your .env file
                </p>
              </div>
            </div>
          )}
        </div>

        {!isConnected && (
          <div className="rounded-lg border border-muted bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Features:</strong>
              <br />• Send transactional emails
              <br />• Process inbound customer emails
              <br />• AI-powered classification & responses
              <br />• Conversation threading & tracking
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
