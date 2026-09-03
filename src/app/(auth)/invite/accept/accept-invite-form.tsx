'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) {
        throw new Error(body.detail || 'Invite is invalid or expired');
      }
      toast({ title: 'Password set', description: 'You can sign in now.' });
      router.push('/login');
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Could not accept invite',
        description: error instanceof Error ? error.message : 'Try again',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Accept your Optix invite</h1>
        <p className="text-muted-foreground text-sm">
          Set a password. You cannot sign in until this step is done.
        </p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <Input
          type="password"
          minLength={8}
          required
          placeholder="New password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading || !token}
        />
        <Button type="submit" disabled={loading || !token || password.length < 8}>
          Set password
        </Button>
      </form>
    </div>
  );
}
