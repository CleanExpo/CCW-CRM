import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Invoice } from "../types";
import { format } from "date-fns";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { Separator } from "@/components/ui/separator";

interface InvoiceDetailDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
}: InvoiceDetailDialogProps) {
  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return `$${num.toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">
              Invoice {invoice.invoice_number}
            </DialogTitle>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <DialogDescription>
            Created {format(new Date(invoice.created_at), "MMMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Customer</h3>
              <p className="mt-1 font-medium">{invoice.customer_name || "—"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Issue Date</h3>
              <p className="mt-1">{format(new Date(invoice.issue_date), "MMM d, yyyy")}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Due Date</h3>
              <p className="mt-1">{format(new Date(invoice.due_date), "MMM d, yyyy")}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Payment Terms</h3>
              <p className="mt-1">{invoice.payment_terms}</p>
            </div>
          </div>

          {invoice.notes && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
              <p className="mt-1 text-sm">{invoice.notes}</p>
            </div>
          )}

          <Separator />

          {/* Line Items */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Line Items</h3>
            <div className="space-y-2">
              {invoice.items?.map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex justify-between items-start p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.total || 0)}</p>
                    <p className="text-xs text-muted-foreground">
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
              <span className="text-muted-foreground">
                Tax ({typeof invoice.tax_rate === "string" ? invoice.tax_rate : invoice.tax_rate.toFixed(2)}%)
              </span>
              <span className="font-medium">{formatCurrency(invoice.tax_amount)}</span>
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
              <span className={parseFloat(invoice.amount_due.toString()) > 0 ? "text-destructive" : "text-green-600"}>
                {formatCurrency(invoice.amount_due)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
