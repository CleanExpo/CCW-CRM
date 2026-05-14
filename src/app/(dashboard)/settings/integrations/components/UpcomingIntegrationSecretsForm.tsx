'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  getUpcomingIntegrationSecrets,
  saveUpcomingIntegrationSecrets,
  type UpcomingIntegrationSecretsStatus,
} from '@/lib/api/upcoming-integration-secrets';
import { Loader2 } from 'lucide-react';

function Row({
  label,
  hint,
  value,
  onChange,
  configured,
  onClear,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  configured: boolean;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-foreground font-medium">{label}</Label>
        {configured ? (
          <span className="text-muted-foreground text-xs">Saved in database</span>
        ) : (
          <span className="text-muted-foreground text-xs">Not saved yet</span>
        )}
      </div>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      <Input
        className="mt-2 font-mono text-sm"
        type="password"
        autoComplete="new-password"
        placeholder={configured ? 'Enter a new key to replace the saved one' : 'Paste API key'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {configured ? (
        <Button type="button" variant="ghost" size="sm" className="mt-1 h-8 text-xs" onClick={onClear}>
          Remove saved key
        </Button>
      ) : null}
    </div>
  );
}

const EMPTY_STATUS: UpcomingIntegrationSecretsStatus = {
  google_ai: { configured: false },
  anthropic: { configured: false },
  heygen: { configured: false },
  ap2: { configured: false },
};

export function UpcomingIntegrationSecretsForm() {
  const { toast } = useToast();
  const [status, setStatus] = useState<UpcomingIntegrationSecretsStatus>(EMPTY_STATUS);
  const [google, setGoogle] = useState('');
  const [anthropic, setAnthropic] = useState('');
  const [heygen, setHeygen] = useState('');
  const [ap2, setAp2] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getUpcomingIntegrationSecrets();
      setStatus(s);
    } catch {
      setStatus({
        google_ai: { configured: false },
        anthropic: { configured: false },
        heygen: { configured: false },
        ap2: { configured: false },
      });
      toast({ variant: 'destructive', title: 'Could not load saved keys' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const body: Record<string, string | null> = {};
    if (google.trim()) body.google_ai_api_key = google.trim();
    if (anthropic.trim()) body.anthropic_api_key = anthropic.trim();
    if (heygen.trim()) body.heygen_api_key = heygen.trim();
    if (ap2.trim()) body.ap2_client_secret = ap2.trim();

    if (Object.keys(body).length === 0) {
      toast({ title: 'Nothing to save', description: 'Enter at least one key, or use Remove on a saved key.' });
      return;
    }

    setSaving(true);
    try {
      const next = await saveUpcomingIntegrationSecrets(body);
      setStatus(next);
      setGoogle('');
      setAnthropic('');
      setHeygen('');
      setAp2('');
      toast({ title: 'Saved', description: 'Upcoming integration keys stored for this workspace.' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Could not save keys',
      });
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async (field: 'google_ai_api_key' | 'anthropic_api_key' | 'heygen_api_key' | 'ap2_client_secret') => {
    setSaving(true);
    try {
      const next = await saveUpcomingIntegrationSecrets({ [field]: null });
      setStatus(next);
      toast({ title: 'Removed', description: 'That key was deleted from the database.' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Remove failed',
        description: e instanceof Error ? e.message : 'Could not remove key',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Keys are stored in the database for this workspace (not read from <code className="bg-muted rounded px-1">.env</code>
        ). Leave a field blank and click Save to leave an existing key unchanged; use Remove to delete a saved key.
      </p>

      <Row
        label="✨ Google Gemini"
        hint="Vision, product attributes, text generation — wire-up in a future release."
        value={google}
        onChange={setGoogle}
        configured={status.google_ai.configured}
        onClear={() => void clearKey('google_ai_api_key')}
      />
      <Row
        label="🤖 Anthropic Claude"
        hint="Autonomous ops, documents, NL queries, copilot — future release."
        value={anthropic}
        onChange={setAnthropic}
        configured={status.anthropic.configured}
        onClear={() => void clearKey('anthropic_api_key')}
      />
      <Row
        label="HeyGen video"
        hint="Avatar video — handlers still stubbed (501) until wired."
        value={heygen}
        onChange={setHeygen}
        configured={status.heygen.configured}
        onClear={() => void clearKey('heygen_api_key')}
      />
      <Row
        label="Google Agent Payments (AP2)"
        hint="Payment agent flows — roadmap; store credentials here when you have them."
        value={ap2}
        onChange={setAp2}
        configured={status.ap2.configured}
        onClear={() => void clearKey('ap2_client_secret')}
      />

      <Button type="button" onClick={() => void handleSave()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save keys
      </Button>
    </div>
  );
}
