"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Eye, Pencil, Trash2 } from "lucide-react";

export interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  is_active: boolean;
}

interface ColumnActionsProps {
  selectedCustomerIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectCustomer: (id: string) => void;
  onViewDetails: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

export function createCustomerColumns({
  selectedCustomerIds,
  onToggleSelectAll,
  onToggleSelectCustomer,
  onViewDetails,
  onEdit,
  onDelete,
}: ColumnActionsProps): ColumnDef<Customer>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={onToggleSelectAll}
          aria-label="Select all customers"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedCustomerIds.includes(row.original.id)}
          onCheckedChange={() => onToggleSelectCustomer(row.original.id)}
          aria-label={`Select ${row.original.company_name}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "customer_number",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer #" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("customer_number")}</span>
      ),
    },
    {
      accessorKey: "company_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Company" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("company_name")}</span>
      ),
    },
    {
      accessorKey: "contact_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Contact" />
      ),
      cell: ({ row }) => row.getValue("contact_name") || "N/A",
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("email") || "N/A"}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Phone" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("phone") || "N/A"}</span>
      ),
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => {
        const customer = row.original;
        return customer.city && customer.state
          ? `${customer.city}, ${customer.state}`
          : "N/A";
      },
      enableSorting: false,
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge variant={row.getValue("is_active") ? "default" : "secondary"}>
          {row.getValue("is_active") ? "Active" : "Inactive"}
        </Badge>
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const customer = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(customer);
              }}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(customer);
              }}
              title="Edit Customer"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(customer);
              }}
              title="Delete Customer"
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
