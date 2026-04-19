'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Pencil, Trash2, Copy, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Quote } from './types';

interface ColumnActionsProps {
  onEdit: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
  onDuplicate: (quote: Quote) => void;
  onConvertToOrder: (quote: Quote) => void;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  pending: 'outline',
  sent: 'default',
  accepted: 'default',
  rejected: 'destructive',
  expired: 'secondary',
};

export function createQuoteColumns({
  onEdit,
  onDelete,
  onDuplicate,
  onConvertToOrder,
}: ColumnActionsProps): ColumnDef<Quote>[] {
  const isExpired = (validUntil: string | null | undefined) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  return [
    {
      accessorKey: 'quote_number',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Quote #" />,
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">{row.getValue('quote_number')}</span>
      ),
    },
    {
      accessorKey: 'customer_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const quote = row.original;
        const status = row.getValue('status') as string;
        const expired = isExpired(quote.valid_until);
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusColors[status] || 'outline'} className="capitalize">
              {status}
            </Badge>
            {expired && status !== 'expired' && <Badge variant="destructive">Expired</Badge>}
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'item_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Items" />,
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => {
        const total = row.getValue('total');
        const numericTotal = typeof total === 'string' ? parseFloat(total) : (total as number);
        return <span className="font-semibold">${numericTotal?.toFixed(2) || '0.00'}</span>;
      },
    },
    {
      accessorKey: 'quote_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Quote Date" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {format(new Date(row.getValue('quote_date')), 'MMM dd, yyyy')}
        </span>
      ),
    },
    {
      accessorKey: 'valid_until',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Valid Until" />,
      cell: ({ row }) => {
        const quote = row.original;
        const expired = isExpired(quote.valid_until);
        return (
          <span
            className={`text-sm ${expired ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
          >
            {quote.valid_until ? format(new Date(quote.valid_until), 'MMM dd, yyyy') : 'N/A'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const quote = row.original;
        return (
          <div className="flex flex-wrap justify-end gap-2">
            {quote.status.toLowerCase() === 'accepted' && (
              <Button
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onConvertToOrder(quote);
                }}
              >
                <ArrowRight className="mr-1 h-3 w-3" />
                Convert
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(quote);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(quote);
              }}
              title="Duplicate Quote"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(quote);
              }}
            >
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
