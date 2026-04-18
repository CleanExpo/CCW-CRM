'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// PHASE 4: Search state persistence
import { useSearchState } from '@/lib/hooks/use-search-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/lib/api/client';
import { OrderStatusBadge } from '@/components/ui/order-status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderForm } from './components/OrderForm';
import { DeleteOrderDialog } from './components/DeleteOrderDialog';
import { BulkDeleteOrdersDialog } from './components/BulkDeleteOrdersDialog';
import { OrderDetailDialog } from './components/OrderDetailDialog';
import { Pencil, Trash2, Plus, Eye, Download, Copy, FileText, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Order } from './types';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { format, formatDistanceToNow } from 'date-fns'; // PHASE 4: Add timestamp display
import { exportOrdersToCSV, exportOrdersToPDF } from '@/lib/utils/csv-export';
import { invoicesApi } from '@/lib/api/invoices';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { EmptyState } from '@/components/ui/empty-state';

interface PaginatedResponse {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // PHASE 4: Last updated timestamp

  // PHASE 4: Search state persistence - remembers pagination + filters on navigation
  const { state: searchState, updateField, isHydrated } = useSearchState({
    key: 'orders-list',
    defaultState: {
      page: 1,
      pageSize: 50,
      search: '',
      statusFilter: 'all',
      dateFrom: '',
      dateTo: '',
    },
  });

  const page = (searchState.page as number | undefined) || 1;
  const pageSize = (searchState.pageSize as number | undefined) || 50;
  const setPage = (value: number) => updateField('page', value);
  const setPageSize = (value: number) => updateField('pageSize', value);

  // UNI-1781: server-side search and filter state (persisted via useSearchState)
  const [search, setSearch] = useState<string>(
    (searchState.search as string | undefined) ?? ''
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    (searchState.statusFilter as string | undefined) ?? 'all'
  );
  const [dateFrom, setDateFrom] = useState<string>(
    (searchState.dateFrom as string | undefined) ?? ''
  );
  const [dateTo, setDateTo] = useState<string>(
    (searchState.dateTo as string | undefined) ?? ''
  );
  // Debounced search value — keeps typing snappy without spamming the backend
  const [debouncedSearch, setDebouncedSearch] = useState<string>(search);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // UNI-1781: one-shot hydration from sessionStorage after the hook finishes loading.
  // useState initializers only see the hook's defaultState, so without this the
  // persisted filters from a previous visit would be ignored.
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    if (isHydrated && !hasHydrated) {
      setSearch((searchState.search as string | undefined) ?? '');
      setStatusFilter((searchState.statusFilter as string | undefined) ?? 'all');
      setDateFrom((searchState.dateFrom as string | undefined) ?? '');
      setDateTo((searchState.dateTo as string | undefined) ?? '');
      setDebouncedSearch((searchState.search as string | undefined) ?? '');
      setHasHydrated(true);
    }
  }, [isHydrated, hasHydrated, searchState]);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      // UNI-1781: build server-side query params from current filter state
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const response = await apiClient.get<PaginatedResponse>(
        `/api/orders?${params.toString()}`
      );

      // Map API response to frontend format
      const mappedOrders = response.items.map((order) => ({
        ...order,
        customer_name: order.customer_name || 'Unknown Customer',
        item_count: order.items?.length ?? order.item_count ?? 0,
      }));

      setOrders(mappedOrders);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load orders';
      console.error('Failed to load orders:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setLastUpdated(new Date()); // PHASE 4: Track last update time
    }
  }, [page, pageSize, debouncedSearch, statusFilter, dateFrom, dateTo, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // UNI-1781: after hydration, when a filter changes snap back to page 1 and persist.
  // Guarded on hasHydrated so we don't clobber the persisted page on first mount.
  useEffect(() => {
    if (!hasHydrated) return;
    if (page !== 1) {
      updateField('page', 1);
    }
    updateField('search', debouncedSearch);
    updateField('statusFilter', statusFilter);
    updateField('dateFrom', dateFrom);
    updateField('dateTo', dateTo);
    // intentionally excludes page / updateField from deps to avoid loops;
    // updateField is stable and page snaps to 1 only when a filter flips post-hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, hasHydrated]);

  const handleAddOrder = () => {
    setSelectedOrder(null);
    setFormOpen(true);
  };

  const handleEditOrder = async (order: Order) => {
    // Fetch full order details including line items
    try {
      const fullOrder = await apiClient.get<Order>(`/api/orders/${order.id}`);
      setSelectedOrder(fullOrder);
      setFormOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load order details';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    }
  };

  // PHASE 4: Duplicate order - quickly create copy with same items
  const handleDuplicateOrder = async (order: Order) => {
    try {
      const fullOrder = await apiClient.get<Order>(`/api/orders/${order.id}`);
      // Create a copy without id (will be treated as new order)
      const orderCopy = {
        ...fullOrder,
        id: undefined, // Remove id to create new order
        order_number: undefined, // Will be auto-generated
        status: 'draft', // Reset to draft
        notes: fullOrder.notes
          ? `Copy of ${fullOrder.order_number}\n\n${fullOrder.notes}`
          : `Copy of ${fullOrder.order_number}`,
      };
      setSelectedOrder(orderCopy as unknown as Order);
      setFormOpen(true);
      toast({
        title: 'Order Duplicated',
        description: 'Review and modify the copy before saving',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate order';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    }
  };

  const handleDeleteOrder = (order: Order) => {
    setSelectedOrder(order);
    setDeleteDialogOpen(true);
  };

  const handleViewDetails = async (order: Order) => {
    // Fetch full order details including line items
    try {
      const fullOrder = await apiClient.get<Order>(`/api/orders/${order.id}`);
      setSelectedOrder(fullOrder);
      setDetailDialogOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load order details';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    }
  };

  // UNI-1781: filtering is now server-side — `orders` already reflects
  // the active search/status/date filters. Previously there was a
  // client-side `orders` memo that only filtered the current page,
  // which gave wrong totals and hid matches on other pages.

  const handleExport = () => {
    exportOrdersToCSV(orders as unknown as Record<string, unknown>[]);
    toast({
      title: 'Export Successful',
      description: `Exported ${orders.length} equipment orders to CSV`,
    });
  };

  const handleExportPDF = () => {
    exportOrdersToPDF(orders as unknown as Record<string, unknown>[]);
    toast({ title: 'PDF Export', description: 'Print dialog opening…' });
  };

  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleteDialogOpen(true);
  };

  const handleGenerateInvoice = async (order: Order) => {
    try {
      const invoice = await invoicesApi.generateFromOrder(order.id);
      toast({
        title: 'Invoice Generated',
        description: `Invoice created — redirecting to invoice.`,
      });
      window.location.href = `/invoices/${invoice.id}`;
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate invoice',
        variant: 'destructive',
      });
    }
  };

  const handleSuccess = () => {
    loadOrders();
    setSelectedOrderIds([]);
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Equipment Orders</h1>
            <p className="text-muted-foreground">
              {selectedOrderIds.length > 0
                ? `${selectedOrderIds.length} selected`
                : 'Manage cleaning equipment sales orders and dispatch'}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedOrderIds.length > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected ({selectedOrderIds.length})
              </Button>
            )}
            <Button variant="outline" onClick={handleExportPDF} disabled={orders.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={orders.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={handleAddOrder}>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Equipment Sales Orders</CardTitle>
                <CardDescription>
                  {total} equipment orders on file
                  {lastUpdated && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      • Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* UNI-1781: Search and filter bar */}
            <div className="mb-4 flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by order # or customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 min-w-48 flex-1 rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <div className="flex items-center gap-2">
                <label className="text-muted-foreground text-sm whitespace-nowrap">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-muted-foreground text-sm whitespace-nowrap">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                />
              </div>
              {(search || statusFilter !== 'all' || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              // UNI-1781: when filters are active, show a filter-aware empty
              // message instead of the "create your first order" onboarding.
              search || statusFilter !== 'all' || dateFrom || dateTo ? (
                <div className="text-muted-foreground py-10 text-center text-sm">
                  No orders match the current filters.
                </div>
              ) : (
                <EmptyState
                  icon={ShoppingCart}
                  title="No equipment orders yet"
                  description="Create your first cleaning equipment order to get started."
                  action={{
                    label: 'Create Order',
                    onClick: handleAddOrder,
                  }}
                />
              )
            ) : (
              <ResponsiveTable
                data={orders}
                keyExtractor={(order) => order.id}
                columns={[
                  {
                    key: 'select',
                    label: (
                      <Checkbox
                        checked={
                          orders.length > 0 &&
                          selectedOrderIds.length === orders.length
                        }
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Select all orders"
                      />
                    ),
                    className: 'w-12',
                    render: (order) => (
                      <Checkbox
                        checked={selectedOrderIds.includes(order.id)}
                        onCheckedChange={() => handleToggleSelectOrder(order.id)}
                        aria-label={`Select order ${order.order_number}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ),
                  },
                  {
                    key: 'order_number',
                    label: 'Order #',
                    className: 'font-mono text-sm font-medium',
                    render: (order) => order.order_number,
                  },
                  {
                    key: 'customer',
                    label: 'Customer',
                    render: (order) => order.customer_name,
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (order) => <OrderStatusBadge status={order.status} />,
                  },
                  {
                    key: 'items',
                    label: 'Items',
                    hideOnMobile: true,
                    render: (order) => order.item_count,
                  },
                  {
                    key: 'total',
                    label: 'Total',
                    className: 'font-semibold',
                    render: (order) => `$${order.total}`,
                  },
                  {
                    key: 'order_date',
                    label: 'Order Date',
                    className: 'text-sm text-muted-foreground',
                    hideOnMobile: true,
                    render: (order) => format(new Date(order.order_date ?? ''), 'MMM dd, yyyy'),
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    className: 'text-right',
                    mobileLabel: '',
                    render: (order) => (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(order);
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
                            handleEditOrder(order);
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
                            handleDuplicateOrder(order);
                          }}
                          title="Duplicate Order"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {(order.status === 'confirmed' || order.status === 'delivered') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateInvoice(order);
                            }}
                            title="Generate Invoice"
                          >
                            <FileText className="h-4 w-4 text-blue-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(order);
                          }}
                          title="Delete Order"
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            )}

            {!loading && orders.length > 0 && (
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

        <OrderForm
          order={selectedOrder}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={handleSuccess}
        />

        <OrderDetailDialog
          order={selectedOrder}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onOrderUpdate={handleSuccess}
        />

        <DeleteOrderDialog
          order={selectedOrder}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onSuccess={handleSuccess}
        />

        <BulkDeleteOrdersDialog
          orderIds={selectedOrderIds}
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          onSuccess={handleSuccess}
        />
      </div>
    </ErrorBoundary>
  );
}
