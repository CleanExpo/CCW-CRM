'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

type MfaEnrollPanelProps = {
  secret?: string;
  otpauthUri?: string;
  recoveryCodes?: string[];
  code: string;
  onCodeChange: (value: string) => void;
  onConfirm: () => void;
  busy?: boolean;
  confirmLabel: string;
  variant?: 'default' | 'marketing';
};

export function MfaEnrollPanel({
  secret,
  otpauthUri,
  recoveryCodes,
  code,
  onCodeChange,
  onConfirm,
  busy = false,
  confirmLabel,
  variant = 'default',
}: MfaEnrollPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const muted = variant === 'marketing' ? 'text-zinc-300' : 'text-muted-foreground';

  useEffect(() => {
    if (!otpauthUri) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(otpauthUri, { width: 192, margin: 1, errorCorrectionLevel: 'M' }).then(
      (url) => {
        if (!cancelled) setQrDataUrl(url);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  return (
    <div className={variant === 'marketing' ? 'space-y-4' : 'space-y-3'}>
      <p className={cn('text-sm', muted)}>
        Scan the QR code in Google Authenticator, 1Password, or Authy. Save the recovery codes, then
        enter a 6-digit code. The secret is generated on this device&apos;s session — it is not sent
        to a third-party QR service.
      </p>
      {qrDataUrl ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="Authenticator QR code"
            width={192}
            height={192}
            className="rounded-md border bg-white p-2"
          />
        </div>
      ) : null}
      {secret ? (
        <div className="rounded-md border p-3 font-mono text-xs break-all">
          <p className={cn('mb-1', muted)}>Secret (if you cannot scan)</p>
          <p>{secret}</p>
        </div>
      ) : null}
      {recoveryCodes?.length ? (
        <div className="rounded-md border p-3 font-mono text-xs">
          <p className={cn('mb-1', muted)}>Recovery codes (save now — shown once)</p>
          <ul className="grid grid-cols-2 gap-1">
            {recoveryCodes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
      />
      <Button
        className="w-full"
        disabled={busy || code.trim().length < 6}
        onClick={() => onConfirm()}
      >
        {busy ? 'Enabling…' : confirmLabel}
      </Button>
    </div>
  );
}
