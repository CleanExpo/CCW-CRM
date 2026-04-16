import { Badge } from '@/components/ui/badge';
import type { TransferStatus } from '@/lib/types/inventory';

interface TransferStatusBadgeProps {
  status: TransferStatus;
}

export function TransferStatusBadge({ status }: TransferStatusBadgeProps) {
  const variants = {
    pending: {
      variant: 'secondary' as const,
      label: 'Pending',
      className:
        'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200',
    },
    in_transit: {
      variant: 'default' as const,
      label: 'In Transit',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200',
    },
    completed: {
      variant: 'default' as const,
      label: 'Completed',
      className:
        'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200',
    },
    cancelled: {
      variant: 'secondary' as const,
      label: 'Cancelled',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200',
    },
  };

  const config = variants[status] || variants.pending;

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
