"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  // State management
  sorting?: SortingState;
  setSorting?: React.Dispatch<React.SetStateAction<SortingState>>;
  columnFilters?: ColumnFiltersState;
  setColumnFilters?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  columnVisibility?: VisibilityState;
  setColumnVisibility?: React.Dispatch<React.SetStateAction<VisibilityState>>;
  rowSelection?: Record<string, boolean>;
  setRowSelection?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  // Pagination (controlled)
  pageSize?: number;
  pageIndex?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  emptyMessage = "No results found",
  emptyDescription,
  emptyAction,
  onRowClick,
  sorting: controlledSorting,
  setSorting: setControlledSorting,
  columnFilters: controlledColumnFilters,
  setColumnFilters: setControlledColumnFilters,
  columnVisibility: controlledColumnVisibility,
  setColumnVisibility: setControlledColumnVisibility,
  rowSelection: controlledRowSelection,
  setRowSelection: setControlledRowSelection,
}: DataTableProps<TData, TValue>) {
  // Internal state (used if controlled state not provided)
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>({});
  const [internalRowSelection, setInternalRowSelection] = React.useState({});

  // Use controlled state if provided, otherwise use internal state
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = setControlledSorting ?? setInternalSorting;
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const setColumnFilters = setControlledColumnFilters ?? setInternalColumnFilters;
  const columnVisibility = controlledColumnVisibility ?? internalColumnVisibility;
  const setColumnVisibility = setControlledColumnVisibility ?? setInternalColumnVisibility;
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const setRowSelection = setControlledRowSelection ?? setInternalRowSelection;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
        {emptyDescription && (
          <p className="text-sm text-muted-foreground mt-2">{emptyDescription}</p>
        )}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
