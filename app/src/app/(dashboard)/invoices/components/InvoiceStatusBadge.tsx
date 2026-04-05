import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/lib/types/invoices";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const variants: Record<
    InvoiceStatus,
    { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
  > = {
    draft: { variant: "secondary", label: "Draft" },
    sent: { variant: "default", label: "Sent" },
    paid: { variant: "default", label: "Paid" },
    overdue: { variant: "destructive", label: "Overdue" },
    cancelled: { variant: "secondary", label: "Cancelled" },
  };

  const config = variants[status] || variants.draft;

  return (
    <Badge variant={config.variant} className="capitalize">
      {config.label}
    </Badge>
  );
}
