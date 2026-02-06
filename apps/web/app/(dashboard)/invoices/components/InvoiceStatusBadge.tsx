import { Badge } from "@/components/ui/badge";
import { Invoice } from "../types";

interface InvoiceStatusBadgeProps {
  status: Invoice["status"];
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const variants: Record<
    Invoice["status"],
    { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
  > = {
    draft: { variant: "secondary", label: "Draft" },
    sent: { variant: "default", label: "Sent" },
    partial: { variant: "outline", label: "Partially Paid" },
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
