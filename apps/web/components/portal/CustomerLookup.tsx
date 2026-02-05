"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, User, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api/client";
import { debounce } from "@/lib/utils/debounce";
import { toast } from "sonner";

interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
}

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total: number;
}

interface CustomerLookupProps {
  onCustomerSelect: (customer: Customer | null) => void;
  selectedCustomer: Customer | null;
}

export function CustomerLookup({
  onCustomerSelect,
  selectedCustomer,
}: CustomerLookupProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createValues, setCreateValues] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editValues, setEditValues] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
  });

  // Debounced search function
  const searchCustomers = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (!searchQuery || searchQuery.length < 2) {
          setResults([]);
          setShowResults(false);
          setIsSearching(false);
          return;
        }

        setIsSearching(true);
        try {
          const response = await apiClient.get<{ items: Customer[] }>(
            `/api/customers?search=${encodeURIComponent(searchQuery)}&page_size=10`
          );
          setResults(response.items || []);
          setShowResults(true);
        } catch (error) {
          console.error("Customer search failed:", error);
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300),
    []
  );

  useEffect(() => {
    return () => searchCustomers.cancel();
  }, [searchCustomers]);

  // Load customer order history
  const loadOrderHistory = async (customerId: string) => {
    setLoadingHistory(true);
    try {
      const response = await apiClient.get<{ items: Order[] }>(
        `/api/orders?customer_id=${customerId}&page_size=5`
      );
      setOrderHistory(response.items || []);
    } catch (error) {
      console.error("Failed to load order history:", error);
      setOrderHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelect = (customer: Customer) => {
    onCustomerSelect(customer);
    setQuery("");
    setResults([]);
    setShowResults(false);
    setShowCreateForm(false);
    setShowEditForm(false);
    loadOrderHistory(customer.id);
  };

  const handleClearCustomer = () => {
    onCustomerSelect(null);
    setOrderHistory([]);
    setQuery("");
    setShowEditForm(false);
  };

  const handleStartCreate = () => {
    const trimmed = query.trim();
    const nextValues = {
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
    };

    if (trimmed) {
      if (trimmed.includes("@")) {
        nextValues.email = trimmed;
      } else if (/[\d\s()+-]{5,}/.test(trimmed)) {
        nextValues.phone = trimmed;
      } else {
        nextValues.company_name = trimmed;
      }
    }

    setCreateValues((prev) => ({ ...prev, ...nextValues }));
    setShowCreateForm(true);
    setShowResults(false);
    setShowEditForm(false);
  };

  const handleCreateCustomer = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const companyName =
      createValues.company_name.trim() || createValues.contact_name.trim();

    if (!companyName) {
      toast.error("Company name is required.");
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        customer_number: `CUST-${Date.now()}`,
        company_name: companyName,
        contact_name: createValues.contact_name.trim() || undefined,
        email: createValues.email.trim() || undefined,
        phone: createValues.phone.trim() || undefined,
      };

      const created = await apiClient.post<Customer>("/api/customers", payload);
      toast.success(`Customer ${created.company_name} created.`);
      setCreateValues({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
      });
      handleSelect(created);
    } catch (error) {
      console.error("Customer creation failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create customer."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = () => {
    if (!selectedCustomer) {
      return;
    }

    setEditValues({
      company_name: selectedCustomer.company_name || "",
      contact_name: selectedCustomer.contact_name || "",
      email: selectedCustomer.email || "",
      phone: selectedCustomer.phone || "",
    });
    setShowEditForm(true);
  };

  const handleUpdateCustomer = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!selectedCustomer) {
      return;
    }

    const companyName = editValues.company_name.trim() || selectedCustomer.company_name;

    setIsUpdating(true);
    try {
      const payload = {
        company_name: companyName,
        contact_name: editValues.contact_name.trim() || undefined,
        email: editValues.email.trim() || undefined,
        phone: editValues.phone.trim() || undefined,
      };

      const updated = await apiClient.put<Customer>(
        `/api/customers/${selectedCustomer.id}`,
        payload
      );
      toast.success("Customer updated.");
      onCustomerSelect(updated);
      setShowEditForm(false);
    } catch (error) {
      console.error("Customer update failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update customer."
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700",
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-blue-100 text-blue-700",
      processing: "bg-purple-100 text-purple-700",
      shipped: "bg-indigo-100 text-indigo-700",
      delivered: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      {!selectedCustomer && (
        <Card className="p-4 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search customer by name, phone, or email..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                searchCustomers(e.target.value);
              }}
              onFocus={() => {
                if (results.length > 0) setShowResults(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowResults(false), 200);
              }}
              className="pl-10"
            />
          </div>

          {/* Search Results Dropdown */}
          {!showCreateForm && showResults && results.length > 0 && (
            <Card className="absolute z-50 mt-2 w-full max-h-80 overflow-y-auto shadow-lg">
              <div className="divide-y">
                {results.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleSelect(customer)}
                    className="w-full p-4 text-left hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{customer.company_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {customer.contact_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{customer.email}</span>
                          <span>|</span>
                          <span>{customer.phone}</span>
                        </div>
                      </div>
                      <Badge variant="outline">{customer.customer_number}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* No Results */}
          {!showCreateForm &&
            showResults &&
            !isSearching &&
            query.length >= 2 &&
            results.length === 0 && (
            <Card className="absolute z-50 mt-2 w-full p-4 shadow-lg">
              <p className="text-sm text-muted-foreground text-center">
                No customers found. Create new customer?
              </p>
              <Button
                variant="outline"
                className="w-full mt-2"
                size="sm"
                onClick={handleStartCreate}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Customer
              </Button>
            </Card>
          )}

          {!showCreateForm && isSearching && (
            <Card className="absolute z-50 mt-2 w-full p-4 shadow-lg">
              <p className="text-sm text-muted-foreground text-center">Searching...</p>
            </Card>
          )}

          {showCreateForm && (
            <form onSubmit={handleCreateCustomer} className="mt-4 border-t pt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">Create new customer</h3>
                  <p className="text-sm text-muted-foreground">
                    Add a quick profile without leaving the order flow.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>

              <div className="grid gap-4 mt-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company name *</Label>
                  <Input
                    id="company_name"
                    value={createValues.company_name}
                    onChange={(event) =>
                      setCreateValues((prev) => ({
                        ...prev,
                        company_name: event.target.value,
                      }))
                    }
                    placeholder="Company or business name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact name</Label>
                  <Input
                    id="contact_name"
                    value={createValues.contact_name}
                    onChange={(event) =>
                      setCreateValues((prev) => ({
                        ...prev,
                        contact_name: event.target.value,
                      }))
                    }
                    placeholder="Primary contact"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_email">Email</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={createValues.email}
                    onChange={(event) =>
                      setCreateValues((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input
                    id="customer_phone"
                    type="tel"
                    value={createValues.phone}
                    onChange={(event) =>
                      setCreateValues((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="0400 000 000"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Customer number is generated automatically.
                </p>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create customer"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* Selected Customer Info */}
      {selectedCustomer && (
        <Card className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{selectedCustomer.company_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedCustomer.contact_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearCustomer}>
                Change
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Customer #</p>
              <p className="font-medium">{selectedCustomer.customer_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="font-medium">{selectedCustomer.phone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{selectedCustomer.email}</p>
            </div>
          </div>

          {showEditForm && (
            <form onSubmit={handleUpdateCustomer} className="mt-4 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-semibold">Quick edit</h4>
                  <p className="text-sm text-muted-foreground">
                    Update key contact details without leaving the order.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditForm(false)}
                >
                  Cancel
                </Button>
              </div>

              <div className="grid gap-4 mt-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit_company_name">Company name</Label>
                  <Input
                    id="edit_company_name"
                    value={editValues.company_name}
                    onChange={(event) =>
                      setEditValues((prev) => ({
                        ...prev,
                        company_name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_contact_name">Contact name</Label>
                  <Input
                    id="edit_contact_name"
                    value={editValues.contact_name}
                    onChange={(event) =>
                      setEditValues((prev) => ({
                        ...prev,
                        contact_name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_email">Email</Label>
                  <Input
                    id="edit_email"
                    type="email"
                    value={editValues.email}
                    onChange={(event) =>
                      setEditValues((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_phone">Phone</Label>
                  <Input
                    id="edit_phone"
                    type="tel"
                    value={editValues.phone}
                    onChange={(event) =>
                      setEditValues((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end">
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          )}

          <Separator className="my-4" />

          {/* Order History */}
          <div>
            <h4 className="font-semibold mb-2">Recent Orders</h4>
            {loadingHistory ? (
              <p className="text-sm text-muted-foreground">Loading history...</p>
            ) : orderHistory.length > 0 ? (
              <div className="space-y-2">
                {orderHistory.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2 bg-muted/30 rounded"
                  >
                    <div>
                      <p className="text-sm font-medium">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.order_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                      <p className="text-sm font-semibold">
                        ${order.total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No previous orders</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
