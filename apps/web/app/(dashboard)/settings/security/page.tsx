'use client';

import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SecuritySettings {
  session_timeout_minutes: number;
}

const MIN_TIMEOUT = 1;
const MAX_TIMEOUT = 1440;

export default function SecuritySettingsPage() {
  const [minutes, setMinutes] = useState<string>('60');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiClient.get<SecuritySettings>('/api/settings/security');
        if (data?.session_timeout_minutes) {
          setMinutes(String(data.session_timeout_minutes));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load security settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    setError(null);
    const numeric = Number(minutes);
    if (!Number.isInteger(numeric) || numeric < MIN_TIMEOUT || numeric > MAX_TIMEOUT) {
      setError(`Enter a whole number between ${MIN_TIMEOUT} and ${MAX_TIMEOUT}.`);
      setSaving(false);
      return;
    }
    try {
      await apiClient.put('/api/settings/security', {
        session_timeout_minutes: numeric,
      });
      setStatus(`Idle timeout set to ${numeric} minute${numeric === 1 ? '' : 's'}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save security settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Security &mdash; Session Timeout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Automatically log out users after a period of inactivity. The timer resets on mouse,
            keyboard, scroll, and touch events. Range: {MIN_TIMEOUT}&ndash;{MAX_TIMEOUT} minutes.
          </p>
          <div className="space-y-2">
            <Label htmlFor="session-timeout">Idle timeout (minutes)</Label>
            <Input
              id="session-timeout"
              type="number"
              min={MIN_TIMEOUT}
              max={MAX_TIMEOUT}
              step="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              disabled={loading || saving}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={loading || saving || !minutes}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {status && <span className="text-sm text-green-600">{status}</span>}
            {error && <span className="text-destructive text-sm">{error}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
