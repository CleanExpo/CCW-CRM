"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerForm } from "./components/CustomerForm";
import { DeleteCustomerDialog } from "./components/DeleteCustomerDialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";

interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
}

interface PaginatedResponse {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  async function loadCustomers() {
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/customers?page=1&page_size=50${search ? `&search=${search}` : ""}`
      );
      setCustomers(response.items);
      setTotal(response.total);
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
    const debounce = setTimeout(loadCustomers, 300);
    return () => clearTimeout(debounce);
  }, [search]);

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

  const handleSuccess = () => {
    loadCustomers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer relationships</p>
        </div>
        <Button onClick={handleAddCustomer}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <Card>
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
              className="max-w-md"
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                No customers found
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {search
                  ? "Try adjusting your search criteria."
                  : "Add your first customer to get started."}
              </p>
              {!search && (
                <Button onClick={handleAddCustomer} className="mt-4">
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
                  key: "customer_number",
                  label: "Customer #",
                  className: "font-mono text-sm",
                  render: (customer) => customer.customer_number,
                },
                {
                  key: "company",
                  label: "Company",
                  className: "font-medium",
                  render: (customer) => customer.company_name,
                },
                {
                  key: "contact",
                  label: "Contact",
                  render: (customer) => customer.contact_name,
                },
                {
                  key: "email",
                  label: "Email",
                  className: "text-sm",
                  render: (customer) => customer.email,
                },
                {
                  key: "phone",
                  label: "Phone",
                  className: "text-sm",
                  hideOnMobile: true,
                  render: (customer) => customer.phone || "N/A",
                },
                {
                  key: "location",
                  label: "Location",
                  hideOnMobile: true,
                  render: (customer) =>
                    customer.city && customer.state ? `${customer.city}, ${customer.state}` : "N/A",
                },
                {
                  key: "status",
                  label: "Status",
                  render: (customer) => (
                    <Badge variant={customer.is_active ? "default" : "secondary"}>
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
                          handleEditCustomer(customer);
                        }}
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
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ),
                },
              ]}
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
    </div>
  );
}
