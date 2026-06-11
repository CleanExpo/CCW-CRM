'use client';

/**
 * CreditLimitBlockedModal
 *
 * Shown when POST /api/orders returns HTTP 402 with code 'CREDIT_LIMIT_EXCEEDED'.
 *
 * - Regular members: see the block message and a Dismiss button only.
 * - Admins / owners: additionally get an "Override & Place Order" button that
 *   re-submits the order with managerOverride=true.
 *
 * Role resolution: we derive isManager from the user's JWT stored in localStorage/cookie
 * via the useCurrentUserRole hook below, mirroring the pattern in EditRoleDialog.
 * The server enforces the actual role check — the frontend just shows/hides the button.
 */

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Decode JWT payload without verification (browser-side read-only, for UI hints only).
 * The server enforces authorisation independently.
 */
function readJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    null
  );
}

function useIsManager(): boolean {
  const [isManager, setIsManager] = useState(false);
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    const payload = readJwtPayload(token);
    if (!payload) return;
    const role = payload.role as string | undefined;
    const isAdmin = payload.is_admin as boolean | undefined;
    setIsManager(Boolean(isAdmin) || role === 'admin' || role === 'owner');
  }, []);
  return isManager;
}

export type CreditLimitBlockedPayload = {
  outstanding: number;
  limit: number;
};

type Props = {
  open: boolean;
  payload: CreditLimitBlockedPayload | null;
  onDismiss: () => void;
  onManagerOverride: () => void;
  isOverriding?: boolean;
};

export function CreditLimitBlockedModal({
  open,
  payload,
  onDismiss,
  onManagerOverride,
  isOverriding = false,
}: Props) {
  const isManager = useIsManager();

  if (!payload) return null;

  const headroom = payload.limit - payload.outstanding;

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-destructive h-6 w-6 shrink-0" />
            <AlertDialogTitle>Credit Limit Exceeded</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                This customer&apos;s outstanding balance would exceed their approved credit limit
                if this order is placed.
              </p>
              <dl className="rounded-md border p-3 text-xs">
                <div className="flex justify-between py-0.5">
                  <dt className="text-muted-foreground">Credit limit</dt>
                  <dd className="font-mono font-semibold">${payload.limit.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between py-0.5">
                  <dt className="text-muted-foreground">Current outstanding</dt>
                  <dd className="font-mono font-semibold text-destructive">
                    ${payload.outstanding.toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between border-t py-0.5 pt-1.5">
                  <dt className="text-muted-foreground">Remaining headroom</dt>
                  <dd className={`font-mono font-bold ${headroom < 0 ? 'text-destructive' : ''}`}>
                    ${headroom.toFixed(2)}
                  </dd>
                </div>
              </dl>
              {isManager ? (
                <p className="text-amber-600 dark:text-amber-400">
                  As a manager you can override this block. The override is logged.
                </p>
              ) : (
                <p>
                  Contact a manager or accounts to increase the credit limit before placing
                  this order.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onDismiss} disabled={isOverriding}>
            Dismiss
          </Button>
          {isManager && (
            <Button
              variant="destructive"
              onClick={onManagerOverride}
              disabled={isOverriding}
            >
              {isOverriding ? 'Placing…' : 'Override & Place Order'}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
