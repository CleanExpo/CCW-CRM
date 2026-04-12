import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Invoice } from '@/lib/types/invoices';
import { format } from 'date-fns';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { Separator } from '@/components/ui/separator';

interface InvoiceDetailDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceDetailDialog({ invoice, open, onOpenChange }: InvoiceDetailDialogProps) {
  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `$${num.toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Invoice {invoice.invoice_number}</DialogTitle>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <DialogDescription>
            Created {format(new Date(invoice.created_at), 'MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">Customer</h3>
              <p className="mt-1 font-medium">{invoice.customer_name || '—'}</p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">Invoice Date</h3>
              <p className="mt-1">{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">Due Date</h3>
              <p className="mt-1">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">Status</h3>
              <p className="mt-1">
                <InvoiceStatusBadge status={invoice.status} />
              </p>
            </div>
          </div>

          {invoice.notes && (
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">Notes</h3>
              <p className="mt-1 text-sm">{invoice.notes}</p>
            </div>
          )}

          <Separator />

          {/* Line Items */}
          <div>
            <h3 className="mb-4 text-lg font-semibold">Line Items</h3>
            <div className="space-y-2">
              {invoice.items?.map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex items-start justify-between rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-muted-foreground text-sm">
                      Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.total || 0)}</p>
                    <p className="text-muted-foreground text-xs">
                      Tax: {formatCurrency(item.tax_amount || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Financial Summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">{formatCurrency(invoice.tax_total)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-medium text-green-600">
                {formatCurrency(invoice.amount_paid)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Amount Due</span>
              <span
                className={
                  parseFloat(invoice.amount_due.toString()) > 0
                    ? 'text-destructive'
                    : 'text-green-600'
                }
              >
                {formatCurrency(invoice.amount_due)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
