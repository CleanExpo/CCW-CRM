'use client';

import { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  label: string | ReactNode;
  render: (item: T) => ReactNode;
  mobileLabel?: string; // Optional different label for mobile
  hideOnMobile?: boolean; // Hide this column on mobile cards
  className?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  mobileCardClassName?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  mobileCardClassName,
}: ResponsiveTableProps<T>) {
  return (
    <>
      {/* Desktop Table - hidden on mobile */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => {
              const rowKey = keyExtractor(item);
              return (
                <TableRow
                  key={rowKey}
                  onClick={() => onRowClick?.(item)}
                  className={onRowClick ? 'cursor-pointer' : ''}
                >
                  {columns.map((column) => (
                    <TableCell key={`${rowKey}-${column.key}`} className={column.className}>
                      {column.render(item)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards - hidden on desktop */}
      <div className="space-y-3 md:hidden">
        {data.map((item) => {
          const rowKey = keyExtractor(item);
          return (
            <Card
              key={rowKey}
              className={cn(
                'space-y-3 p-4',
                onRowClick && 'hover:bg-accent cursor-pointer transition-colors',
                mobileCardClassName
              )}
              onClick={() => onRowClick?.(item)}
            >
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div
                    key={`${rowKey}-${column.key}`}
                    className="flex items-start justify-between gap-4"
                  >
                    <span className="text-muted-foreground min-w-[100px] text-sm font-medium">
                      {column.mobileLabel || column.label}
                    </span>
                    <div className="flex-1 text-right text-sm">{column.render(item)}</div>
                  </div>
                ))}
            </Card>
          );
        })}
      </div>
    </>
  );
}
