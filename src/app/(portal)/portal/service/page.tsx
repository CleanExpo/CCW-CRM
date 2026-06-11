'use client';

import { useState } from 'react';
import { Wrench, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
// UNI-2115: customer identity is always derived from the authenticated session,
// never from a hardcoded or caller-supplied value.
import { usePortalCustomer } from '@/hooks/use-portal-customer';

type RequestType = 'warranty_claim' | 'service_booking' | 'general_inquiry';

interface ServiceRequest {
  request_id: string;
  reference_number: string;
  request_type: RequestType;
  description: string;
  status: string;
  created_at: string;
}

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  warranty_claim: 'Warranty Claim',
  service_booking: 'Service Booking',
  general_inquiry: 'General Inquiry',
};

export default function PortalServicePage() {
  const { toast } = useToast();
  // UNI-2115: Load customer context from the session. The customer_id is
  // resolved server-side by /api/portal/customer-context — it is never read
  // from a prop, URL param, or hardcoded literal.
  const { customer } = usePortalCustomer();
  const [requestType, setRequestType] = useState<RequestType>('warranty_claim');
  const [orderNumber, setOrderNumber] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ServiceRequest | null>(null);
  const [history, setHistory] = useState<ServiceRequest[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast({
        title: 'Required',
        description: 'Please describe your request.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post<ServiceRequest>('/api/portal/service-requests', {
        order_id: orderNumber || null,
        product_sku: sku || null,
        request_type: requestType,
        description,
        preferred_contact: 'email',
      });
      setSubmitted(res);
      setHistory((prev) => [res, ...prev]);
      setDescription('');
      setOrderNumber('');
      setSku('');
      toast({ title: 'Request lodged', description: `Reference: ${res.reference_number}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Service Requests</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Lodge warranty claims, book a service, or ask a general question.
          {customer && (
            <span className="ml-1 text-slate-400">
              — Account: <span className="font-medium text-slate-600">{customer.company_name}</span>
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Request</CardTitle>
            <CardDescription>We aim to respond within 1 business day.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Request type */}
              <div className="space-y-1.5">
                <Label>Request Type</Label>
                <div className="flex flex-wrap gap-2">
                  {(['warranty_claim', 'service_booking', 'general_inquiry'] as RequestType[]).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRequestType(t)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          requestType === t
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 text-slate-600 hover:border-blue-300'
                        }`}
                      >
                        {REQUEST_TYPE_LABELS[t]}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Optional fields */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="order">Order Number (optional)</Label>
                  <Input
                    id="order"
                    placeholder="ORD-2026-XXXX"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sku">Product SKU (optional)</Label>
                  <Input
                    id="sku"
                    placeholder="e.g. TM-PRO-570"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label htmlFor="description">Description *</Label>
                <textarea
                  id="description"
                  rows={4}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  placeholder={
                    requestType === 'warranty_claim'
                      ? 'Describe the fault, when it occurred, and the unit serial number…'
                      : requestType === 'service_booking'
                        ? 'What equipment needs servicing, and when are you available?'
                        : 'How can we help you today?'
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                <Wrench className="mr-2 h-4 w-4" />
                {submitting ? 'Submitting…' : 'Submit Request'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Confirmation + history */}
        <div className="space-y-4">
          {submitted && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="flex items-start gap-3 pt-4">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Request lodged</p>
                  <p className="text-sm text-green-700">
                    Reference:{' '}
                    <span className="font-mono font-medium">{submitted.reference_number}</span>
                  </p>
                  <p className="mt-1 text-xs text-green-600">
                    Our team will contact you within 1 business day.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {history.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">This Session&apos;s Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.map((req) => (
                  <div
                    key={req.request_id}
                    className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{REQUEST_TYPE_LABELS[req.request_type]}</p>
                      <p className="font-mono text-xs text-slate-400">{req.reference_number}</p>
                    </div>
                    <Badge variant="outline">{req.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex items-start gap-3 pt-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <div className="text-sm text-slate-600">
                <p className="font-medium">Urgent equipment breakdown?</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Call our priority service line:{' '}
                  <a href="tel:1300229266" className="text-blue-600 hover:underline">
                    1300 CCW CCW
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
