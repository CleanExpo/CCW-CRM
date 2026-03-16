"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// PHASE 4: Search state persistence
import { useSearchState } from "@/lib/hooks/use-search-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerForm } from "./components/CustomerForm";
import { DeleteCustomerDialog } from "./components/DeleteCustomerDialog";
import { BulkDeleteCustomersDialog } from "./components/BulkDeleteCustomersDialog";
import { Pencil, Trash2, Plus, Eye, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { exportCustomersToCSV } from "@/lib/utils/csv-export";
// PHASE 4: Last updated timestamps
import { formatDistanceToNow } from "date-fns";
import { createCustomerColumns, Customer as CustomerType } from "./columns";

type Customer = CustomerType;

interface PaginatedResponse {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function CustomersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // PHASE 4: Last updated timestamp
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // PHASE 4: Search state persistence - remembers search/pagination on navigation
  const { state: searchState, updateField } = useSearchState({
    key: "customers-list",
    defaultState: { search: "", page: 1, pageSize: 50 },
  });

  const search = searchState.search || "";
  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const setSearch = (value: string) => updateField("search", value);
  const setPage = (value: number) => updateField("page", value);
  const setPageSize = (value: number) => updateField("pageSize", value);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/customers?page=${page}&page_size=${pageSize}${
          debouncedSearch ? `&search=${debouncedSearch}` : ""
        }`
      );
      setCustomers(response.items);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load customers";
      console.error("Failed to load customers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setLastUpdated(new Date()); // PHASE 4: Track last update time
    }
  }, [page, pageSize, debouncedSearch, toast]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setFormOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormOpen(true);
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  const handleViewDetails = (customer: Customer) => {
    router.push(`/customers/${customer.id}`);
  };

  const handleExport = () => {
    exportCustomersToCSV(customers as unknown as Record<string, unknown>[]);
    toast({
      title: "Export Successful",
      description: `Exported ${customers.length} customers to CSV`,
    });
  };

  const handleToggleSelectCustomer = (customerId: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedCustomerIds.length === customers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(customers.map((c) => c.id));
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleteDialogOpen(true);
  };

  const handleSuccess = () => {
    loadCustomers();
    setSelectedCustomerIds([]);
  };

  const columns = createCustomerColumns({
    selectedCustomerIds,
    onToggleSelectAll: handleToggleSelectAll,
    onToggleSelectCustomer: handleToggleSelectCustomer,
    onViewDetails: handleViewDetails,
    onEdit: handleEditCustomer,
    onDelete: handleDeleteCustomer,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            {selectedCustomerIds.length > 0
              ? `${selectedCustomerIds.length} selected`
              : "Manage your customer relationships"}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedCustomerIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedCustomerIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={customers.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleAddCustomer}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Directory</CardTitle>
              <CardDescription>
                {total} customers in database
                {lastUpdated && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    • Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="mt-4">
            <Input
              placeholder="Search customers by name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={customers}
            loading={loading}
            emptyMessage="No customers found"
            emptyDescription={
              search
                ? "Try adjusting your search criteria."
                : "Add your first customer to get started."
            }
            emptyAction={
              !search && (
                <Button onClick={handleAddCustomer}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              )
            }
          />

          {!loading && customers.length > 0 && (
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>

      <CustomerForm
        customer={selectedCustomer}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleSuccess}
      />

      <DeleteCustomerDialog
        customer={selectedCustomer}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleSuccess}
      />

      <BulkDeleteCustomersDialog
        customerIds={selectedCustomerIds}
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
