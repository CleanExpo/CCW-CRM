'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, BookOpen, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface AnthropicConnectStepProps {
  onComplete: (data?: Record<string, unknown>) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isOptional: boolean;
}

const SETUP_STEPS = [
  'Go to console.anthropic.com and sign in (or create a free account)',
  'Click "API Keys" in the left sidebar',
  'Click "Create Key" — give it a name like "CCW ERP"',
  'Copy the key immediately (it starts with sk-ant- and is only shown once)',
  'Paste it into the field below and click Connect',
];

export function AnthropicConnectStep({
  onComplete,
  onSkip,
  onBack,
  canGoBack,
  isOptional,
}: AnthropicConnectStepProps) {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const isValidKey = apiKey.startsWith('sk-ant-');

  async function handleConnect() {
    if (!isValidKey) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post('/api/integrations/anthropic/configure', { api_key: apiKey });
      setIsConnected(true);
    } catch {
      setError(
        'Could not save the API key. Make sure the backend is reachable and the key starts with sk-ant-.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isConnected) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Claude AI Connected!</h3>
            <p className="text-muted-foreground text-sm">
              Autonomous ops, document extraction, NL queries, and the staff copilot are now active.
            </p>
            <p className="mt-1 font-mono text-xs text-purple-600">claude-sonnet-4-6</p>
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
          CCW uses Claude (claude-sonnet-4-6) for autonomous operations, document extraction,
          natural-language queries, and the staff copilot. Paste your Anthropic API key below to
          activate these features.
        </AlertDescription>
      </Alert>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          What Claude powers in CCW
        </div>
        <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
          <li>Autonomous order and quote processing</li>
          <li>PDF / document data extraction</li>
          <li>Natural-language search across customers, orders, and products</li>
          <li>Staff copilot — ask questions, get instant ERP insights</li>
        </ul>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Anthropic API Key</label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="font-mono text-sm"
        />
        {apiKey.length > 0 && !isValidKey && (
          <p className="text-xs text-red-600">Key must start with sk-ant-</p>
        )}
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
          <span>Where do I get an API key? (2 min)</span>
          <Badge variant="outline">{showInstructions ? 'Hide' : 'Show steps'}</Badge>
        </button>
        {showInstructions && (
          <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
            {SETUP_STEPS.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex items-center gap-1 text-sm hover:underline"
        >
          Open Anthropic Console <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={!canGoBack || isSaving}>
          Back
        </Button>
        <div className="flex gap-2">
          {isOptional && (
            <Button variant="ghost" onClick={onSkip} disabled={isSaving}>
              Skip for Now
            </Button>
          )}
          <Button onClick={handleConnect} disabled={isSaving || !isValidKey}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect Claude
          </Button>
        </div>
      </div>
    </div>
  );
}
