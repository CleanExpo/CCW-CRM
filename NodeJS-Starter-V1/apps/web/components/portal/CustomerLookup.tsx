"use client";

import { useState, useCallback } from "react";
import { Search, User, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api/client";
import { debounce } from "lodash";

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
  onCustomerSelect: (customer: Customer) => void;
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

  // Debounced search function
  const searchCustomers = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults([]);
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
    loadOrderHistory(customer.id);
  };

  const handleClearCustomer = () => {
    onCustomerSelect(null as any);
    setOrderHistory([]);
    setQuery("");
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
        <Card className="p-4">
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
          {showResults && results.length > 0 && (
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
                          <span>•</span>
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
          {showResults && !isSearching && query.length >= 2 && results.length === 0 && (
            <Card className="absolute z-50 mt-2 w-full p-4 shadow-lg">
              <p className="text-sm text-muted-foreground text-center">
                No customers found. Create new customer?
              </p>
              <Button variant="outline" className="w-full mt-2" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create New Customer
              </Button>
            </Card>
          )}

          {isSearching && (
            <Card className="absolute z-50 mt-2 w-full p-4 shadow-lg">
              <p className="text-sm text-muted-foreground text-center">Searching...</p>
            </Card>
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
            <Button variant="ghost" size="sm" onClick={handleClearCustomer}>
              Change
            </Button>
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
