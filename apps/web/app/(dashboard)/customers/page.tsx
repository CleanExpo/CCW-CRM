'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// PHASE 4: Search state persistence
import { useSearchState } from '@/lib/hooks/use-search-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomerForm } from './components/CustomerForm';
import { DeleteCustomerDialog } from './components/DeleteCustomerDialog';
import { BulkDeleteCustomersDialog } from './components/BulkDeleteCustomersDialog';
import { Pencil, Trash2, Plus, Eye, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { exportCustomersToCSV } from '@/lib/utils/csv-export';
// PHASE 4: Last updated timestamps
import { formatDistanceToNow } from 'date-fns';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

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
  abn: string | null;
  /** UNI-1829: Credit management fields */
  credit_limit: number | null;
  credit_hold: boolean;
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
  const router = useRouter();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // PHASE 4: Last updated timestamp
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  // PHASE 4: Search state persistence - remembers search/pagination on navigation
  const { state: searchState, updateField } = useSearchState({
    key: 'customers-list',
    defaultState: { search: '', page: 1, pageSize: 50 },
  });

  const search = searchState.search || '';
  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const setSearch = useCallback((value: string) => updateField('search', value), [updateField]);
  const setPage = useCallback((value: number) => updateField('page', value), [updateField]);
  const setPageSize = useCallback((value: number) => updateField('pageSize', value), [updateField]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/customers?page=${page}&page_size=${pageSize}${
          debouncedSearch ? `&search=${debouncedSearch}` : ''
        }`
      );
      setCustomers(response.items);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load customers';
      toast({
        variant: 'destructive',
        title: 'Error',
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
  }, [search, setPage]);

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
      title: 'Export Successful',
      description: `Exported ${customers.length} customers to CSV`,
    });
  };

  const handleToggleSelectCustomer = (customerId: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
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
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customer Accounts</h1>
            <p className="text-muted-foreground">
              {selectedCustomerIds.length > 0
                ? `${selectedCustomerIds.length} selected`
                : 'Manage cleaning contractors and trade businesses'}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedCustomerIds.length > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete}>
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
                <CardTitle>Contractor &amp; Business Directory</CardTitle>
                <CardDescription>
                  {total} cleaning businesses and trade contractors on file
                  {lastUpdated && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      • Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="mt-4">
              <Input
                placeholder="Search contractors, cleaning businesses, or trade accounts..."
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
                <p className="text-muted-foreground text-lg font-medium">No customers found</p>
                <p className="text-muted-foreground mt-2 text-sm">
                  {search
                    ? 'Try adjusting your search criteria.'
                    : 'Register your first cleaning business or contractor to get started.'}
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
                    key: 'select',
                    label: (
                      <Checkbox
                        checked={
                          customers.length > 0 && selectedCustomerIds.length === customers.length
                        }
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Select all customers"
                      />
                    ),
                    className: 'w-12',
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
                    key: 'customer_number',
                    label: 'Customer #',
                    className: 'font-mono text-sm',
                    render: (customer) => customer.customer_number,
                  },
                  {
                    key: 'company',
                    label: 'Company',
                    className: 'font-medium',
                    render: (customer) => customer.company_name,
                  },
                  {
                    key: 'contact',
                    label: 'Contact',
                    render: (customer) => customer.contact_name,
                  },
                  {
                    key: 'email',
                    label: 'Email',
                    className: 'text-sm',
                    render: (customer) => customer.email,
                  },
                  {
                    key: 'phone',
                    label: 'Phone',
                    className: 'text-sm',
                    hideOnMobile: true,
                    render: (customer) => customer.phone || 'N/A',
                  },
                  {
                    key: 'location',
                    label: 'Location',
                    hideOnMobile: true,
                    render: (customer) =>
                      customer.city && customer.state
                        ? `${customer.city}, ${customer.state}`
                        : 'N/A',
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (customer) => (
                      <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                        {customer.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    ),
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    className: 'text-right',
                    mobileLabel: '',
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
                          <Trash2 className="text-destructive h-4 w-4" />
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
    </ErrorBoundary>
  );
}
