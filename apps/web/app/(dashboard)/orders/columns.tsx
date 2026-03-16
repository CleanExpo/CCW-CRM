"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Pencil, Trash2, Copy } from "lucide-react";
import { format } from "date-fns";
import type { Order } from "./types";

interface ColumnActionsProps {
  selectedOrderIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectOrder: (id: string) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  onDuplicate: (order: Order) => void;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending: "outline",
  confirmed: "default",
  processing: "default",
  shipped: "default",
  delivered: "default",
  cancelled: "destructive",
};

export function createOrderColumns({
  selectedOrderIds,
  onToggleSelectAll,
  onToggleSelectOrder,
  onEdit,
  onDelete,
  onDuplicate,
}: ColumnActionsProps): ColumnDef<Order>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={onToggleSelectAll}
          aria-label="Select all orders"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedOrderIds.includes(row.original.id)}
          onCheckedChange={() => onToggleSelectOrder(row.original.id)}
          aria-label={`Select ${row.original.order_number}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "order_number",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Order #" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">{row.getValue("order_number")}</span>
      ),
    },
    {
      accessorKey: "customer_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant={statusColors[status] || "outline"}
            className="capitalize"
          >
            {status}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "item_count",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Items" />
      ),
    },
    {
      accessorKey: "total",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total" />
      ),
      cell: ({ row }) => {
        const total = row.getValue("total");
        const numericTotal = typeof total === "string" ? parseFloat(total) : (total as number);
        return (
          <span className="font-semibold">
            ${numericTotal?.toFixed(2) || "0.00"}
          </span>
        );
      },
    },
    {
      accessorKey: "order_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Order Date" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.getValue("order_date")), "MMM dd, yyyy")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const order = row.original;
        return (
          <div className="flex justify-end gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(order);
              }}
              title="Edit Order"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(order);
              }}
              title="Duplicate Order"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(order);
              }}
              title="Delete Order"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
