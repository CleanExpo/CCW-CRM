'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PackageCheck, RefreshCw, Plus, ChevronRight } from 'lucide-react';
import {
  cin7FulfilmentApi,
  type Cin7Fulfilment,
  type Cin7Invoice,
  type Cin7Payment,
  type FulfilmentStatus,
  type InvoiceStatus,
} from '@/lib/api/cin7-fulfilment';

// ---------------------------------------------------------------------------
// Badge colour helpers
// ---------------------------------------------------------------------------

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

function fulfilmentBadgeVariant(status: string): BadgeVariant {
  switch (status as FulfilmentStatus) {
    case 'pending':
      return 'secondary';
    case 'picking':
    case 'packing':
    case 'shipped':
      return 'default';
    case 'delivered':
      return 'default';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

// We render picking/packing/shipped with a blue/amber/purple tint via className
function fulfilmentBadgeClass(status: string): string {
  switch (status as FulfilmentStatus) {
    case 'picking':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'packing':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'shipped':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'delivered':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return '';
  }
}

function invoiceBadgeVariant(status: string): BadgeVariant {
  switch (status as InvoiceStatus) {
    case 'draft':
      return 'secondary';
    case 'sent':
      return 'default';
    case 'paid':
      return 'default';
    case 'overdue':
      return 'destructive';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function invoiceBadgeClass(status: string): string {
  switch (status as InvoiceStatus) {
    case 'sent':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'paid':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return '';
  }
}

function paymentBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'failed':
    case 'refunded':
      return 'destructive';
    default:
      return 'outline';
  }
}

function paymentBadgeClass(status: string): string {
  return status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : '';
}

// ---------------------------------------------------------------------------
// Demo fallback data
// ---------------------------------------------------------------------------

const DEMO_FULFILMENTS: Cin7Fulfilment[] = [
  {
    id: 'demo-f1',
    cin7_order_mapping_id: 'demo-m1',
    cin7_fulfilment_id: 'FUL-1001',
    status: 'picking',
    pick_location: 'Zone A - Shelf 3',
    tracking_number: null,
    carrier: null,
    shipped_at: null,
    delivered_at: null,
    notes: 'Priority pick for key account',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_reference: 'ORD-2024-001',
  },
  {
    id: 'demo-f2',
    cin7_order_mapping_id: 'demo-m2',
    cin7_fulfilment_id: 'FUL-1002',
    status: 'shipped',
    pick_location: 'Zone B - Shelf 7',
    tracking_number: '1Z999AA10123456784',
    carrier: 'AusPost eParcel',
    shipped_at: '2024-03-01T09:00:00Z',
    delivered_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_reference: 'ORD-2024-002',
  },
  {
    id: 'demo-f3',
    cin7_order_mapping_id: 'demo-m3',
    cin7_fulfilment_id: null,
    status: 'pending',
    pick_location: null,
    tracking_number: null,
    carrier: null,
    shipped_at: null,
    delivered_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_reference: 'ORD-2024-003',
  },
];

const DEMO_INVOICES: Cin7Invoice[] = [
  {
    id: 'demo-i1',
    cin7_order_mapping_id: 'demo-m1',
    cin7_invoice_id: 'INV-CIN7-001',
    invoice_number: 'INV-2024-0001',
    invoice_date: '2024-03-01',
    due_date: '2024-03-31',
    amount: '1250.00',
    currency: 'AUD',
    status: 'sent',
    paid_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_reference: 'ORD-2024-001',
  },
  {
    id: 'demo-i2',
    cin7_order_mapping_id: 'demo-m2',
    cin7_invoice_id: 'INV-CIN7-002',
    invoice_number: 'INV-2024-0002',
    invoice_date: '2024-02-15',
    due_date: '2024-03-15',
    amount: '3450.00',
    currency: 'AUD',
    status: 'overdue',
    paid_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_reference: 'ORD-2024-002',
  },
  {
    id: 'demo-i3',
    cin7_order_mapping_id: 'demo-m3',
    cin7_invoice_id: 'INV-CIN7-003',
    invoice_number: 'INV-2024-0003',
    invoice_date: '2024-01-20',
    due_date: '2024-02-20',
    amount: '780.50',
    currency: 'AUD',
    status: 'paid',
    paid_at: '2024-02-18T10:00:00Z',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_reference: 'ORD-2024-003',
  },
];

const DEMO_PAYMENTS: Cin7Payment[] = [
  {
    id: 'demo-p1',
    cin7_invoice_id: 'demo-i3',
    cin7_payment_id: 'PAY-CIN7-001',
    payment_method: 'Bank Transfer',
    amount: '780.50',
    currency: 'AUD',
    payment_date: '2024-02-18',
    reference: 'REF-20240218',
    status: 'completed',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-p2',
    cin7_invoice_id: null,
    cin7_payment_id: 'PAY-CIN7-002',
    payment_method: 'Credit Card',
    amount: '500.00',
    currency: 'AUD',
    payment_date: '2024-03-05',
    reference: null,
    status: 'pending',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-p3',
    cin7_invoice_id: null,
    cin7_payment_id: null,
    payment_method: 'Cheque',
    amount: '250.00',
    currency: 'AUD',
    payment_date: '2024-03-10',
    reference: 'CHQ-0042',
    status: 'failed',
    created_at: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Status label helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function nextFulfilmentStatus(current: FulfilmentStatus): FulfilmentStatus | null {
  const transitions: Record<FulfilmentStatus, FulfilmentStatus | null> = {
    pending: 'picking',
    picking: 'packing',
    packing: 'shipped',
    shipped: 'delivered',
    delivered: null,
    cancelled: null,
  };
  return transitions[current] ?? null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NewFulfilmentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (f: Cin7Fulfilment) => void;
}

function NewFulfilmentDialog({ open, onClose, onCreated }: NewFulfilmentDialogProps) {
  const { toast } = useToast();
  const [mappingId, setMappingId] = useState('');
  const [pickLocation, setPickLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!mappingId.trim()) {
      toast({
        title: 'Validation error',
        description: 'Order mapping ID is required',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      const result = await cin7FulfilmentApi.createFulfilment({
        cin7_order_mapping_id: mappingId.trim(),
        pick_location: pickLocation || null,
        notes: notes || null,
      });
      toast({ title: 'Fulfilment created', description: `Status: ${result.status}` });
      onCreated(result);
      onClose();
      setMappingId('');
      setPickLocation('');
      setNotes('');
    } catch {
      toast({ title: 'Error', description: 'Failed to create fulfilment', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Fulfilment</DialogTitle>
          <DialogDescription>
            Create a fulfilment record for a Cin7 order mapping.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="mapping-id">Order Mapping ID</Label>
            <Input
              id="mapping-id"
              placeholder="UUID of the Cin7 order mapping"
              value={mappingId}
              onChange={(e) => setMappingId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pick-location">Pick Location</Label>
            <Input
              id="pick-location"
              placeholder="e.g. Zone A - Shelf 3"
              value={pickLocation}
              onChange={(e) => setPickLocation(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MarkPaidDialogProps {
  invoice: Cin7Invoice | null;
  onClose: () => void;
  onPaid: (updated: Cin7Invoice) => void;
}

function MarkPaidDialog({ invoice, onClose, onPaid }: MarkPaidDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (invoice) setAmount(invoice.amount);
  }, [invoice]);

  async function handleSubmit() {
    if (!invoice) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Validation error',
        description: 'Amount must be a positive number',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      const updated = await cin7FulfilmentApi.markInvoicePaid(invoice.id, {
        amount: parsedAmount,
        payment_method: method || null,
      });
      toast({ title: 'Invoice marked as paid', description: `Invoice ${invoice.invoice_number}` });
      onPaid(updated);
      onClose();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to mark invoice as paid',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
          <DialogDescription>
            {invoice
              ? `Invoice ${invoice.invoice_number} — ${invoice.currency} ${invoice.amount}`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="paid-amount">Payment Amount ({invoice?.currency ?? 'AUD'})</Label>
            <Input
              id="paid-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay-method">Payment Method</Label>
            <Input
              id="pay-method"
              placeholder="e.g. Bank Transfer, Credit Card"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Mark Paid'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function OrderFulfilmentPage() {
  const { toast } = useToast();

  const [fulfilments, setFulfilments] = useState<Cin7Fulfilment[]>([]);
  const [invoices, setInvoices] = useState<Cin7Invoice[]>([]);
  const [payments, setPayments] = useState<Cin7Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [newFulfilmentOpen, setNewFulfilmentOpen] = useState(false);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<Cin7Invoice | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [syncingInvoices, setSyncingInvoices] = useState(false);

  // Initial load — all three tabs in parallel
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const [fRes, iRes, pRes] = await Promise.allSettled([
        cin7FulfilmentApi.listFulfilments(1, 20),
        cin7FulfilmentApi.listInvoices(1, 20),
        cin7FulfilmentApi.listPayments(1, 20),
      ]);
      setFulfilments(fRes.status === 'fulfilled' ? fRes.value.items : DEMO_FULFILMENTS);
      setInvoices(iRes.status === 'fulfilled' ? iRes.value.items : DEMO_INVOICES);
      setPayments(pRes.status === 'fulfilled' ? pRes.value.items : DEMO_PAYMENTS);
      setLoading(false);
    }
    loadAll();
  }, []);

  // Advance a fulfilment to its next status
  async function handleAdvanceStatus(fulfilment: Cin7Fulfilment) {
    const next = nextFulfilmentStatus(fulfilment.status as FulfilmentStatus);
    if (!next) return;

    setAdvancingId(fulfilment.id);
    try {
      const updated = await cin7FulfilmentApi.updateFulfilmentStatus(fulfilment.id, {
        status: next,
      });
      setFulfilments((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      toast({
        title: 'Status updated',
        description: `Fulfilment advanced to ${formatStatus(updated.status)}`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } finally {
      setAdvancingId(null);
    }
  }

  // Sync invoices from Cin7
  async function handleSyncInvoices() {
    setSyncingInvoices(true);
    try {
      const result = await cin7FulfilmentApi.syncInvoices();
      toast({ title: 'Sync complete', description: result.message });
      // Reload invoices
      const iRes = await cin7FulfilmentApi.listInvoices(1, 20);
      setInvoices(iRes.items.length > 0 ? iRes.items : DEMO_INVOICES);
    } catch {
      toast({
        title: 'Sync error',
        description: 'Failed to sync invoices from Cin7',
        variant: 'destructive',
      });
    } finally {
      setSyncingInvoices(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <nav className="text-muted-foreground mb-1 flex items-center gap-1 text-sm">
          <span>Orders</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Fulfilment</span>
        </nav>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PackageCheck className="text-primary h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Order Fulfilment</h1>
              <p className="text-muted-foreground text-sm">
                Pick, pack, ship and invoice Cin7 sales orders
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="fulfilments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fulfilments">Fulfilments</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        {/* ---- Fulfilments tab ---- */}
        <TabsContent value="fulfilments" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {loading ? 'Loading...' : `${fulfilments.length} fulfilment(s)`}
            </p>
            <Button size="sm" onClick={() => setNewFulfilmentOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Fulfilment
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Ref</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pick Location</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Shipped At</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      Loading fulfilments...
                    </TableCell>
                  </TableRow>
                ) : fulfilments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      No fulfilments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  fulfilments.map((f) => {
                    const next = nextFulfilmentStatus(f.status as FulfilmentStatus);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">
                          {f.order_reference ?? f.cin7_order_mapping_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={fulfilmentBadgeVariant(f.status)}
                            className={fulfilmentBadgeClass(f.status)}
                          >
                            {formatStatus(f.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{f.pick_location ?? '—'}</TableCell>
                        <TableCell>{f.tracking_number ?? '—'}</TableCell>
                        <TableCell>{f.carrier ?? '—'}</TableCell>
                        <TableCell>
                          {f.shipped_at ? new Date(f.shipped_at).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {next && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={advancingId === f.id}
                              onClick={() => handleAdvanceStatus(f)}
                            >
                              {advancingId === f.id
                                ? 'Saving...'
                                : `Advance to ${formatStatus(next)}`}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ---- Invoices tab ---- */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {loading ? 'Loading...' : `${invoices.length} invoice(s)`}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={syncingInvoices}
              onClick={handleSyncInvoices}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncingInvoices ? 'animate-spin' : ''}`} />
              {syncingInvoices ? 'Syncing...' : 'Sync from Cin7'}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Order Ref</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      Loading invoices...
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      No invoices found. Click "Sync from Cin7" to pull invoices.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number ?? '—'}</TableCell>
                      <TableCell>
                        {inv.order_reference ?? inv.cin7_order_mapping_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {inv.currency} {parseFloat(inv.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={invoiceBadgeVariant(inv.status)}
                          className={invoiceBadgeClass(inv.status)}
                        >
                          {formatStatus(inv.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setMarkPaidInvoice(inv)}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ---- Payments tab ---- */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {loading ? 'Loading...' : `${payments.length} payment(s)`}
            </p>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      Loading payments...
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.payment_method ?? '—'}</TableCell>
                      <TableCell>
                        {p.currency} {parseFloat(p.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>{p.reference ?? '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={paymentBadgeVariant(p.status)}
                          className={paymentBadgeClass(p.status)}
                        >
                          {formatStatus(p.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <NewFulfilmentDialog
        open={newFulfilmentOpen}
        onClose={() => setNewFulfilmentOpen(false)}
        onCreated={(f) => setFulfilments((prev) => [f, ...prev])}
      />
      <MarkPaidDialog
        invoice={markPaidInvoice}
        onClose={() => setMarkPaidInvoice(null)}
        onPaid={(updated) =>
          setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)))
        }
      />
    </div>
  );
}
