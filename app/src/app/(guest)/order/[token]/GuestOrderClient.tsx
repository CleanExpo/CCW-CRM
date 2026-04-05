'use client';

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  User,
  MapPin,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { approveGuestOrder, declineGuestOrder, type CustomerOrderResponse } from '@/lib/api/mobile';

interface GuestOrderClientProps {
  initialOrder: CustomerOrderResponse;
  token: string;
}

type ActionState = 'idle' | 'approving' | 'declining' | 'approved' | 'declined' | 'error';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Awaiting Your Review',
    color: 'text-amber-400',
    icon: <Clock className="h-5 w-5 text-amber-400" />,
  },
  viewed: {
    label: 'Awaiting Your Decision',
    color: 'text-blue-400',
    icon: <Clock className="h-5 w-5 text-blue-400" />,
  },
  approved: {
    label: 'Order Approved',
    color: 'text-green-400',
    icon: <CheckCircle className="h-5 w-5 text-green-400" />,
  },
  payment_pending: {
    label: 'Payment Pending',
    color: 'text-amber-400',
    icon: <Clock className="h-5 w-5 text-amber-400" />,
  },
  paid: {
    label: 'Payment Received',
    color: 'text-green-400',
    icon: <CheckCircle className="h-5 w-5 text-green-400" />,
  },
  dispatched: {
    label: 'Order Dispatched',
    color: 'text-blue-400',
    icon: <Package className="h-5 w-5 text-blue-400" />,
  },
  declined: {
    label: 'Order Declined',
    color: 'text-red-400',
    icon: <XCircle className="h-5 w-5 text-red-400" />,
  },
  expired: {
    label: 'Link Expired',
    color: 'text-slate-400',
    icon: <AlertTriangle className="h-5 w-5 text-slate-400" />,
  },
  cancelled: {
    label: 'Order Cancelled',
    color: 'text-slate-400',
    icon: <XCircle className="h-5 w-5 text-slate-400" />,
  },
};

export function GuestOrderClient({ initialOrder, token }: GuestOrderClientProps) {
  const [order] = useState(initialOrder);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showApproveNotes, setShowApproveNotes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const statusConfig = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const isActionable = ['pending', 'viewed'].includes(order.status) && !order.is_expired;
  const isExpired = order.is_expired || order.status === 'expired';

  const expiresAt = new Date(order.expires_at);
  const expiresFormatted = expiresAt.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  async function handleApprove() {
    setActionState('approving');
    setErrorMessage(null);
    try {
      const result = await approveGuestOrder(token, approvalNotes || undefined);
      setSuccessMessage(result.message);
      setActionState('approved');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Approval failed. Please try again.');
      setActionState('error');
    }
  }

  async function handleDecline() {
    if (!declineReason.trim()) {
      setErrorMessage('Please provide a reason for declining.');
      return;
    }
    setActionState('declining');
    setErrorMessage(null);
    try {
      const result = await declineGuestOrder(token, declineReason);
      setSuccessMessage(result.message);
      setActionState('declined');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not decline order. Please try again.'
      );
      setActionState('error');
    }
  }

  // -----------------------------------------------------------------------
  // Render: Post-action confirmation screens
  // -----------------------------------------------------------------------

  if (actionState === 'approved') {
    return (
      <GuestLayout>
        <div className="px-6 py-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="mb-3 text-2xl font-bold text-slate-900">Order Approved!</h1>
          <p className="mx-auto max-w-sm text-lg leading-relaxed text-slate-600">
            {successMessage ??
              "Your order has been approved. We'll be in touch shortly to confirm payment."}
          </p>
          <p className="mt-6 text-sm text-slate-400">
            {order.tradesperson_name} will receive your confirmation.
          </p>
        </div>
      </GuestLayout>
    );
  }

  if (actionState === 'declined') {
    return (
      <GuestLayout>
        <div className="px-6 py-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="mb-3 text-2xl font-bold text-slate-900">Order Declined</h1>
          <p className="mx-auto max-w-sm leading-relaxed text-slate-600">
            {successMessage ?? 'Order declined. The tradesperson will be notified.'}
          </p>
        </div>
      </GuestLayout>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Main order review
  // -----------------------------------------------------------------------
  return (
    <GuestLayout>
      {/* Header */}
      <div className="bg-slate-900 px-6 py-6 text-white">
        <div className="mx-auto max-w-lg">
          <p className="mb-1 text-sm text-slate-400">Order from</p>
          <h1 className="text-2xl font-bold">{order.tradesperson_name}</h1>
          <div className="mt-3 flex items-center gap-2">
            {statusConfig.icon}
            <span className={`font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
          </div>
          {isExpired && (
            <p className="mt-2 text-sm text-red-400">
              This approval link expired on {expiresFormatted}.
            </p>
          )}
          {!isExpired && isActionable && (
            <p className="mt-2 text-sm text-slate-400">Link expires {expiresFormatted}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-6 py-6">
        {/* Customer greeting */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
            <User className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{order.customer_name}</p>
            <p className="text-sm text-slate-500">Please review your order below</p>
          </div>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Order items */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Order Items</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.product_name}</p>
                  {item.sku && <p className="text-xs text-slate-400">SKU: {item.sku}</p>}
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <p className="text-sm font-medium text-slate-900">
                    ${(item.quantity * item.unit_price).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.quantity} × ${item.unit_price.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Totals */}
        <section className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-900">${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-slate-500">GST (10%)</span>
            <span className="text-slate-900">${order.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between px-4 py-4 text-lg font-bold">
            <span className="text-slate-900">Total</span>
            <span className="text-slate-900">${order.total.toFixed(2)}</span>
          </div>
        </section>

        {/* Delivery address */}
        {order.delivery_address && Object.keys(order.delivery_address).length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">Delivery Address</h2>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              {(Object.values(order.delivery_address) as string[]).map((line, i) => (
                <p key={i} className="text-sm text-slate-700">
                  {line}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Notes */}
        {order.notes && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">Notes</h2>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm text-slate-700">{order.notes}</p>
            </div>
          </section>
        )}

        {/* Already actioned / expired messages */}
        {!isActionable && !isExpired && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center">
            {statusConfig.icon && (
              <div className="mb-2 flex justify-center">{statusConfig.icon}</div>
            )}
            <p className="text-sm text-slate-600">
              This order has already been <strong>{order.status}</strong>.
            </p>
          </div>
        )}

        {isExpired && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
            <p className="text-sm font-medium text-amber-800">This approval link has expired.</p>
            <p className="mt-1 text-xs text-amber-600">
              Contact {order.tradesperson_name} to request a new link.
            </p>
          </div>
        )}

        {/* Action buttons — only shown when actionable */}
        {isActionable && actionState === 'idle' && (
          <div className="space-y-3 pt-2">
            {/* Approve */}
            <div className="space-y-2">
              <button
                onClick={() => setShowApproveNotes(!showApproveNotes)}
                className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                <span>Add approval notes (optional)</span>
                {showApproveNotes ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showApproveNotes && (
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={2}
                  placeholder="Any notes for the tradesperson…"
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none"
                />
              )}
              <button
                onClick={handleApprove}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-green-600 py-4 text-lg font-bold text-white shadow-lg shadow-green-600/25 transition-all hover:bg-green-500 active:scale-[0.98]"
              >
                <CheckCircle className="h-6 w-6" />
                Approve Order — ${order.total.toFixed(2)}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Decline */}
            {!showDeclineForm ? (
              <button
                onClick={() => setShowDeclineForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 py-3 font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <XCircle className="h-5 w-5" />
                Decline
              </button>
            ) : (
              <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                <label className="block text-sm font-medium text-red-800">
                  Why are you declining? *
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                  placeholder="Please let us know why you're declining this order…"
                  className="w-full resize-none rounded-xl border border-red-200 bg-white px-4 py-3 text-sm focus:border-red-500 focus:outline-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeclineForm(false)}
                    className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={!declineReason.trim()}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirm Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {(actionState === 'approving' || actionState === 'declining') && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="text-sm text-slate-500">
              {actionState === 'approving' ? 'Approving your order…' : 'Submitting your response…'}
            </p>
          </div>
        )}

        {/* CCW trust signals footer */}
        <footer className="space-y-3 border-t border-slate-100 pt-6 pb-6 text-center">
          <div className="flex justify-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              SSL Secured
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Australian Business
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              No obligation to approve
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Powered by <strong className="text-slate-600">CCW Online</strong> — Australia's cleaning
            equipment specialists
            <br />
            <a href="tel:1300CCWONLINE" className="text-blue-500 hover:underline">
              Questions? Call us on 1300 CCW
            </a>
          </p>
        </footer>
      </div>
    </GuestLayout>
  );
}

// Minimal layout wrapper used within this component tree
function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}
