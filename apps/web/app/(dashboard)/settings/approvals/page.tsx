'use client';

import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ApprovalThreshold {
  scope: string;
  amount_aud: string;
}

const DEFAULT_SCOPE = 'default';

export default function ApprovalsSettingsPage() {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiClient.get<ApprovalThreshold[]>('/api/settings/approval-thresholds');
        const existing = data.find((t: ApprovalThreshold) => t.scope === DEFAULT_SCOPE);
        setAmount(existing ? existing.amount_aud : '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load threshold');
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
    try {
      await apiClient.put('/api/settings/approval-thresholds', {
        amount_aud: amount,
        scope: DEFAULT_SCOPE,
      });
      setStatus(`Threshold saved — POs under AUD ${amount} will auto-approve.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save threshold');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Purchase Order Approval Threshold</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Purchase orders with a total below this amount will auto-approve. Orders at or above
            this amount will land in the approvals queue for human review.
          </p>
          <div className="space-y-2">
            <Label htmlFor="threshold">Threshold (AUD)</Label>
            <Input
              id="threshold"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              disabled={loading || saving}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={loading || saving || !amount}>
              {saving ? 'Saving…' : 'Save threshold'}
            </Button>
            {status && <span className="text-sm text-green-600">{status}</span>}
            {error && <span className="text-destructive text-sm">{error}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
