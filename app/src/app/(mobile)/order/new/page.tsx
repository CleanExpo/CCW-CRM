'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, Minus, Plus, Send, Star } from 'lucide-react';
import { PhotoCaptureWidget } from '@/components/mobile/PhotoCaptureWidget';
import {
  uploadProductPhoto,
  mobileApi,
  type PhotoUploadResponse,
  type OrderItem,
} from '@/lib/api/mobile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'capture' | 'review' | 'customer' | 'sent';

interface EditableItem extends OrderItem {
  confidence?: number;
  included: boolean;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewMobileOrderPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('capture');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState<PhotoUploadResponse | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Customer details
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [orderToken, setOrderToken] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Step 1: Photo captured → upload + AI recognition
  // -----------------------------------------------------------------------
  async function handlePhotoCapture(file: File) {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await uploadProductPhoto(file);
      setRecognitionResult(result);

      const editableItems: EditableItem[] = result.matches.map((m) => ({
        product_id: m.product_id ?? undefined,
        product_name: m.product_name,
        sku: m.sku ?? undefined,
        quantity: m.suggested_quantity,
        unit_price: 0, // Tradesperson sets price in review step
        confidence: m.confidence,
        included: m.confidence >= 0.4,
      }));

      setItems(editableItems);
      setStep('review');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process photo');
    } finally {
      setIsProcessing(false);
    }
  }

  // -----------------------------------------------------------------------
  // Step 2: Review items
  // -----------------------------------------------------------------------
  function adjustQty(idx: number, delta: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  }

  function toggleItem(idx: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, included: !item.included } : item))
    );
  }

  function setPrice(idx: number, price: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, unit_price: parseFloat(price) || 0 } : item))
    );
  }

  const includedItems = items.filter((i) => i.included);
  const subtotal = includedItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  // -----------------------------------------------------------------------
  // Step 3: Send to customer
  // -----------------------------------------------------------------------
  async function handleSendToCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim()) return;
    if (includedItems.length === 0) {
      setError('Please include at least one item.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const orderItems = includedItems.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        sku: i.sku,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }));

      const result = await mobileApi.createGuestOrder({
        image_id: recognitionResult?.image_id,
        customer_email: customerEmail.trim(),
        customer_name: customerName.trim(),
        items: orderItems,
        notes: customerNotes.trim() || undefined,
        expires_hours: 72,
      });

      setApprovalUrl(result.approval_url);
      setOrderToken(result.token);
      setStep('sent');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold text-white">New Order</h1>
          <div className="flex gap-1">
            {(['capture', 'review', 'customer'] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full transition-colors ${
                  step === s
                    ? 'bg-blue-500'
                    : ['review', 'customer', 'sent'].indexOf(step) > i
                      ? 'bg-green-500'
                      : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-6">
        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-700 bg-red-900/40 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* ----------------------------------------------------------------
            Step 1: Capture
        ---------------------------------------------------------------- */}
        {step === 'capture' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Photograph the cleaning equipment to automatically identify products.
            </p>
            <PhotoCaptureWidget
              onCapture={handlePhotoCapture}
              isProcessing={isProcessing}
              disabled={isProcessing}
            />
            {recognitionResult?.context_description && (
              <p className="text-sm text-slate-400 italic">
                &ldquo;{recognitionResult.context_description}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------
            Step 2: Review recognised items
        ---------------------------------------------------------------- */}
        {step === 'review' && (
          <div className="space-y-4">
            {recognitionResult?.low_confidence_warning && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-700 bg-amber-900/30 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <p className="text-sm text-amber-300">
                  Low confidence matches — please verify items before sending.
                </p>
              </div>
            )}

            <h2 className="text-lg font-semibold text-white">
              {items.length} product{items.length !== 1 ? 's' : ''} identified
            </h2>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border bg-slate-800 p-4 transition-colors ${
                    item.included ? 'border-slate-700' : 'border-slate-700/40 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={() => toggleItem(idx)}
                      className="mt-1 h-4 w-4 rounded"
                      aria-label={`Include ${item.product_name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {item.product_name}
                        </p>
                        {item.confidence !== undefined && (
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs ${
                              item.confidence >= 0.8
                                ? 'bg-green-900/60 text-green-300'
                                : item.confidence >= 0.6
                                  ? 'bg-amber-900/60 text-amber-300'
                                  : 'bg-red-900/60 text-red-300'
                            }`}
                          >
                            {Math.round(item.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      {item.sku && <p className="text-xs text-slate-500">SKU: {item.sku}</p>}
                    </div>
                  </div>

                  {item.included && (
                    <div className="mt-3 flex items-center gap-3">
                      {/* Quantity */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustQty(idx, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3 text-white" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => adjustQty(idx, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3 text-white" />
                        </button>
                      </div>

                      {/* Unit price */}
                      <div className="flex flex-1 items-center gap-1">
                        <span className="text-sm text-slate-400">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price || ''}
                          onChange={(e) => setPrice(idx, e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                          aria-label={`Price for ${item.product_name}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            {includedItems.length > 0 && (
              <div className="space-y-2 rounded-xl bg-slate-800 p-4">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-400">
                  <span>GST (10%)</span>
                  <span>${gst.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 font-semibold text-white">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setStep('customer')}
              disabled={includedItems.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue to Customer Details
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* ----------------------------------------------------------------
            Step 3: Customer details
        ---------------------------------------------------------------- */}
        {step === 'customer' && (
          <form onSubmit={handleSendToCustomer} className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Send to Customer</h2>
            <p className="text-sm text-slate-400">
              The customer will receive a link to review and approve this order.
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Customer Email *
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Notes (optional)
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  rows={3}
                  placeholder="Any special instructions or delivery notes…"
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Order summary */}
            <div className="rounded-xl bg-slate-800 p-4">
              <p className="mb-2 text-xs font-medium tracking-wide text-slate-400 uppercase">
                Order Summary
              </p>
              {includedItems.map((item, i) => (
                <div key={i} className="flex justify-between py-1 text-sm">
                  <span className="text-white">
                    {item.quantity}× {item.product_name}
                  </span>
                  <span className="text-slate-300">
                    ${(item.quantity * item.unit_price).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 font-semibold text-white">
                <span>Total (inc. GST)</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !customerName.trim() || !customerEmail.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send Approval Link
                </>
              )}
            </button>
          </form>
        )}

        {/* ----------------------------------------------------------------
            Step 4: Sent confirmation
        ---------------------------------------------------------------- */}
        {step === 'sent' && (
          <div className="space-y-6 py-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
              <Star className="h-10 w-10 text-green-400" />
            </div>
            <div>
              <h2 className="mb-2 text-2xl font-bold text-white">Order Sent!</h2>
              <p className="text-slate-400">
                {customerName} will receive a link to review and approve their order.
              </p>
            </div>

            {approvalUrl && (
              <div className="rounded-xl bg-slate-800 p-4 text-left">
                <p className="mb-2 text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Approval Link
                </p>
                <p className="text-sm break-all text-blue-400">{approvalUrl}</p>
                <button
                  onClick={() => navigator.clipboard?.writeText(approvalUrl)}
                  className="mt-3 text-xs text-slate-400 underline hover:text-white"
                >
                  Copy to clipboard
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setStep('capture');
                  setRecognitionResult(null);
                  setItems([]);
                  setCustomerName('');
                  setCustomerEmail('');
                  setCustomerNotes('');
                  setApprovalUrl(null);
                  setOrderToken(null);
                  setError(null);
                }}
                className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Create Another Order
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full rounded-xl bg-slate-800 py-4 font-semibold text-slate-300 transition-colors hover:bg-slate-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
