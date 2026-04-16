'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, ExternalLink, BookOpen } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface XeroConnectStepProps {
  onComplete: (data?: Record<string, unknown>) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isOptional: boolean;
}

const XERO_STEPS = [
  'Go to developer.xero.com → click "My Apps" → "New App"',
  'Choose "Web App" and fill in any app name (e.g. "CCW ERP")',
  'Add this Redirect URI: your-backend-url/api/integrations/xero/callback',
  'Tick scopes: accounting.contacts, accounting.transactions, accounting.reports.read, offline_access',
  'Click "Save" then copy your Client ID and Client Secret',
  'Paste both into the backend environment variables (Railway → Variables), then restart the service',
  'Come back here and click Connect Xero',
];

export function XeroConnectStep({
  onComplete,
  onSkip,
  onBack,
  canGoBack,
  isOptional,
}: XeroConnectStepProps) {
  const searchParams = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Detect successful return from Xero OAuth
  useEffect(() => {
    if (searchParams.get('xero_success') === 'true') {
      setIsConnected(true);
    }
  }, [searchParams]);

  async function handleConnect() {
    setIsConnecting(true);
    setError(null);
    try {
      const data = await apiClient.get<{ auth_url: string }>(
        '/api/integrations/xero/authorize?organization_id=default'
      );
      // Redirect to Xero OAuth — browser returns to /onboarding?xero_success=true
      window.location.href = data.auth_url;
    } catch {
      setError(
        'Could not reach the backend. Make sure the Railway backend URL is set in Vercel settings (NEXT_PUBLIC_BACKEND_URL) and that Xero credentials are configured.'
      );
      setIsConnecting(false);
    }
  }

  if (isConnected) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Xero Connected!</h3>
            <p className="text-muted-foreground text-sm">
              Your customers, invoices, and payment history will sync automatically.
            </p>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={() => onComplete({ connected: true })}>Continue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Connecting Xero will import all your existing customers, invoices, and payment history
          into the ERP automatically. You can skip this and connect later from Settings →
          Integrations.
        </AlertDescription>
      </Alert>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          What gets imported from Xero
        </div>
        <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
          <li>All contacts / customers</li>
          <li>Invoice history (paid and outstanding)</li>
          <li>Payment records</li>
          <li>New orders in CCW ERP will create invoices in Xero automatically</li>
        </ul>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3 rounded-lg border p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-medium"
          onClick={() => setShowInstructions(!showInstructions)}
        >
          <span>First time? Set up Xero API access (5 min)</span>
          <Badge variant="outline">{showInstructions ? 'Hide' : 'Show steps'}</Badge>
        </button>
        {showInstructions && (
          <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
            {XERO_STEPS.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        <a
          href="https://developer.xero.com/app/manage"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex items-center gap-1 text-sm hover:underline"
        >
          Open Xero Developer Portal <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={!canGoBack || isConnecting}>
          Back
        </Button>
        <div className="flex gap-2">
          {isOptional && (
            <Button variant="ghost" onClick={onSkip} disabled={isConnecting}>
              Skip for Now
            </Button>
          )}
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect Xero
          </Button>
        </div>
      </div>
    </div>
  );
}
