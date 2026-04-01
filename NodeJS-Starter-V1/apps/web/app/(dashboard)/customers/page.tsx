"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerForm } from "./components/CustomerForm";
import { DeleteCustomerDialog } from "./components/DeleteCustomerDialog";
import { BulkDeleteCustomersDialog } from "./components/BulkDeleteCustomersDialog";
import { Pencil, Trash2, Plus, Eye, Download, Users, Mail, Phone, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { exportCustomersToCSV } from "@/lib/utils/csv-export";

interface Customer {
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

interface PaginatedResponse {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Helper function to get customer initials
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Helper function to get consistent color for customer
function getAvatarColor(id: string): string {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-green-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-cyan-500",
  ];
  const index = parseInt(id.substring(0, 8), 16) % colors.length;
  return colors[index];
}

export default function CustomersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/customers?page=${page}&page_size=${pageSize}${search ? `&search=${search}` : ""}`
      );
      setCustomers(response.items);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: any) {
      console.error("Failed to load customers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load customers",
      });
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      // Reset to page 1 when search changes
      if (page !== 1) {
        setPage(1);
      } else {
        loadCustomers();
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  useEffect(() => {
    loadCustomers();
  }, [page, pageSize]);

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
    exportCustomersToCSV(customers);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Customers
          </h1>
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

      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Directory</CardTitle>
              <CardDescription>
                {total} customers in database
              </CardDescription>
            </div>
          </div>
          <div className="mt-4">
            <Input
              placeholder="Search customers by name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md focus:border-brand-primary-600 focus:ring-2 focus:ring-brand-primary-600/20 dark:focus:border-brand-primary-400 dark:focus:ring-brand-primary-400/20 transition-all"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !customers || customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-brand-primary-100 p-4 mb-4 dark:bg-brand-primary-950">
                <Users className="h-10 w-10 text-brand-primary-600 dark:text-brand-primary-400" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                No customers found
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {search
                  ? "Try adjusting your search criteria to find what you're looking for."
                  : "Get started by adding your first customer to build your directory."}
              </p>
              {!search && (
                <Button onClick={handleAddCustomer} className="mt-6">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              )}
            </div>
          ) : (
            <ResponsiveTable
              data={customers}
              keyExtractor={(customer) => customer.id}
              columns={[
                {
                  key: "select",
                  label: (
                    <Checkbox
                      checked={
                        customers.length > 0 &&
                        selectedCustomerIds.length === customers.length
                      }
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Select all customers"
                    />
                  ),
                  className: "w-12",
                  render: (customer) => (
                    <Checkbox
                      checked={selectedCustomerIds.includes(customer.id)}
                      onCheckedChange={() => handleToggleSelectCustomer(customer.id)}
                      aria-label={`Select ${customer.company_name}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ),
                },
                {
                  key: "customer_number",
                  label: "Customer #",
                  className: "font-mono text-sm",
                  render: (customer) => customer.customer_number,
                },
                {
                  key: "company",
                  label: "Company",
                  className: "font-medium",
                  render: (customer) => (
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-semibold shrink-0 ${getAvatarColor(customer.id)}`}>
                        {getInitials(customer.company_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{customer.company_name}</div>
                        {customer.contact_name && (
                          <div className="text-xs text-muted-foreground truncate">{customer.contact_name}</div>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "email",
                  label: "Email",
                  className: "text-sm",
                  render: (customer) => customer.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  ),
                },
                {
                  key: "phone",
                  label: "Phone",
                  className: "text-sm",
                  hideOnMobile: true,
                  render: (customer) => customer.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{customer.phone}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  ),
                },
                {
                  key: "location",
                  label: "Location",
                  hideOnMobile: true,
                  render: (customer) => customer.city && customer.state ? (
                    <Badge variant="outline" className="border-brand-accent-200 text-brand-accent-700 dark:border-brand-accent-800 dark:text-brand-accent-400">
                      <MapPin className="h-3 w-3 mr-1" />
                      {customer.city}, {customer.state}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (customer) => (
                    <Badge
                      variant={customer.is_active ? "default" : "secondary"}
                      className={customer.is_active ? "bg-success text-success-foreground border-success/20" : ""}
                    >
                      {customer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions",
                  className: "text-right",
                  mobileLabel: "",
                  render: (customer) => (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(customer);
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
                          handleEditCustomer(customer);
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
                          handleDeleteCustomer(customer);
                        }}
                        title="Delete Customer"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}

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
