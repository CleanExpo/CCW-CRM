import { Badge } from '@/components/ui/badge';
import { ScanBarcode } from 'lucide-react';

type ScanComingSoonProps = {
  /** Short label for the surface, e.g. "Inventory", "Invoices", "Purchase orders". */
  context: string;
  /** Optional extra detail under the title. */
  description?: string;
};

/**
 * Unified “scanning is not available yet” panel for dashboard barcode / document scan entry points.
 */
export function ScanComingSoon({ context, description }: ScanComingSoonProps) {
  return (
    <div className="border-muted-foreground/25 bg-muted/30 text-muted-foreground rounded-lg border border-dashed p-6">
      <div className="flex flex-wrap items-center gap-2">
        <ScanBarcode className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
        <span className="text-foreground text-sm font-semibold">Scanning — coming soon</span>
        <Badge variant="secondary" className="text-[10px] uppercase">
          Preview
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        {description ??
          `${context} scanning (hardware barcode readers and document capture) is not enabled in this build. Data entry continues to work manually.`}
      </p>
    </div>
  );
}
