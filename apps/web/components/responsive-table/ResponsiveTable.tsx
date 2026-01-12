"use client";

import { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  label: string;
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
            {data.map((item) => (
              <TableRow
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? "cursor-pointer" : ""}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards - hidden on desktop */}
      <div className="md:hidden space-y-3">
        {data.map((item) => (
          <Card
            key={keyExtractor(item)}
            className={cn(
              "p-4 space-y-3",
              onRowClick && "cursor-pointer hover:bg-accent transition-colors",
              mobileCardClassName
            )}
            onClick={() => onRowClick?.(item)}
          >
            {columns
              .filter((column) => !column.hideOnMobile)
              .map((column) => (
                <div key={column.key} className="flex justify-between items-start gap-4">
                  <span className="text-sm font-medium text-muted-foreground min-w-[100px]">
                    {column.mobileLabel || column.label}
                  </span>
                  <div className="text-sm text-right flex-1">{column.render(item)}</div>
                </div>
              ))}
          </Card>
        ))}
      </div>
    </>
  );
}
