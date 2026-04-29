'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
// PHASE 4: Search state persistence
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import {
  OperationsPageHeader,
  OperationsPageLayout,
} from '@/components/operations/OperationsPageHeader';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { OrderStatusBadge } from '@/components/ui/order-status-badge';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchState } from '@/hooks/use-search-state';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { invoicesApi } from '@/lib/api/invoices';
import { formatAud, opCardClass, opHeroSurfaceClass } from '@/lib/operations/ui';
import { cn } from '@/lib/utils';
import { exportOrdersToCSV, exportOrdersToPDF } from '@/lib/utils/csv-export';
import { format, formatDistanceToNow } from 'date-fns'; // PHASE 4: Add timestamp display
import {
  AlertCircle,
  Copy,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { BulkDeleteOrdersDialog } from './components/BulkDeleteOrdersDialog';
import { DeleteOrderDialog } from './components/DeleteOrderDialog';
import { OrderDetailDialog } from './components/OrderDetailDialog';
import { OrderForm } from './components/OrderForm';
import { Order } from './types';

interface PaginatedResponse {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface CountResponse {
  total: number;
}

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // PHASE 4: Last updated timestamp

  // PHASE 4: Search state persistence - remembers pagination on navigation
  const { state: searchState, updateField } = useSearchState({
    key: 'orders-list',
    defaultState: { page: 1, pageSize: 50 },
  });

  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const setPage = (value: number) => updateField('page', value);
  const setPageSize = (value: number) => updateField('pageSize', value);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [prereqState, setPrereqState] = useState<{
    loaded: boolean;
    hasCustomers: boolean;
    hasProducts: boolean;
  }>({ loaded: false, hasCustomers: false, hasProducts: false });
  const [prereqDialogOpen, setPrereqDialogOpen] = useState(false);

  const loadPrerequisites = useCallback(async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        apiClient.get<CountResponse>('/api/customers?page=1&page_size=1'),
        apiClient.get<CountResponse>('/api/products?page=1&page_size=1'),
      ]);
      const hasCustomers = custRes.total > 0;
      const hasProducts = prodRes.total > 0;
      setPrereqState({ loaded: true, hasCustomers, hasProducts });
      return { hasCustomers, hasProducts };
    } catch (error: unknown) {
      console.error('Failed to load prerequisites:', error);
      setPrereqState({ loaded: true, hasCustomers: false, hasProducts: false });
      return { hasCustomers: false, hasProducts: false };
    }
  }, []);

  useEffect(() => {
    void loadPrerequisites();
  }, [loadPrerequisites]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/orders?page=${page}&page_size=${pageSize}`
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
  }, [page, pageSize, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;

    let cancelled = false;
    void (async () => {
      const { hasCustomers, hasProducts } = await loadPrerequisites();
      if (cancelled) return;

      const next = new URLSearchParams(searchParams.toString());
      next.delete('create');
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });

      if (!hasCustomers || !hasProducts) {
        setPrereqDialogOpen(true);
        return;
      }
      setSelectedOrder(null);
      setFormOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, pathname, router, loadPrerequisites]);

  const openNewOrderIfAllowed = useCallback(async () => {
    const { hasCustomers, hasProducts } = await loadPrerequisites();
    if (!hasCustomers || !hasProducts) {
      setPrereqDialogOpen(true);
      return;
    }
    setSelectedOrder(null);
    setFormOpen(true);
  }, [loadPrerequisites]);

  const handleAddOrder = () => {
    void openNewOrderIfAllowed();
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
    const { hasCustomers, hasProducts } = await loadPrerequisites();
    if (!hasCustomers || !hasProducts) {
      setPrereqDialogOpen(true);
      return;
    }
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
      window.location.href = `/dashboard/finance/invoices/${invoice.id}`;
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate invoice',
        variant: 'destructive',
      });
    }
  };

  const handleSuccess = (meta?: { created?: boolean }) => {
    if (meta?.created) {
      setPage(1);
    }
    void loadPrerequisites();
    loadOrders();
    setSelectedOrderIds([]);
  };

  const canCreateOrder = prereqState.hasCustomers && prereqState.hasProducts;

  return (
    <ErrorBoundary>
      <OperationsPageLayout className="space-y-6">
        <OperationsPageHeader
          accent="ocean"
          title="Equipment Orders"
          description={
            selectedOrderIds.length > 0
              ? `${selectedOrderIds.length} order(s) selected — use actions below or bulk delete.`
              : 'Manage cleaning equipment sales orders, dispatch, and customer fulfilment.'
          }
          icon={ShoppingCart}
          actions={
            <>
              {selectedOrderIds.length > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedOrderIds.length})
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
            </>
          }
        />

        {prereqState.loaded && !canCreateOrder && (
          <Alert className="my-4 border-amber-500/40 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertTitle>Before you can create an order</AlertTitle>
            <AlertDescription className="text-foreground/90 mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {!prereqState.hasCustomers && !prereqState.hasProducts
                  ? 'Add at least one customer and one product to your catalog.'
                  : !prereqState.hasCustomers
                    ? 'Add at least one customer in CRM.'
                    : 'Add at least one product in Inventory.'}
              </span>
              <span className="flex flex-wrap gap-2">
                {!prereqState.hasCustomers && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/crm/customers">Go to Customers</Link>
                  </Button>
                )}
                {!prereqState.hasProducts && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/inventory/products">Go to Products</Link>
                  </Button>
                )}
              </span>
            </AlertDescription>
          </Alert>
        )}

        <Card className={cn(opCardClass, opHeroSurfaceClass)}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Equipment Sales Orders</CardTitle>
                <CardDescription className="dark:text-foreground/70">
                  {total} equipment orders on file
                  {lastUpdated && (
                    <span className="text-muted-foreground dark:text-foreground/60 ml-2 text-xs">
                      • Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No equipment orders yet"
                description="Create your first cleaning equipment order to get started."
                action={{
                  label: 'Create Order',
                  onClick: handleAddOrder,
                }}
              />
            ) : (
              <ResponsiveTable
                data={orders}
                keyExtractor={(order) => order.id}
                columns={[
                  {
                    key: 'select',
                    label: (
                      <Checkbox
                        checked={orders.length > 0 && selectedOrderIds.length === orders.length}
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
                    className: 'font-semibold tabular-nums',
                    render: (order) => formatAud(order.total),
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

        <AlertDialog open={prereqDialogOpen} onOpenChange={setPrereqDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Set up customers and products first</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-left [&_strong]:font-semibold [&_strong]:text-zinc-800 dark:[&_strong]:text-zinc-100">
                <span className="block">
                  Every order needs a customer and at least one catalog product on the line items.
                </span>
                {!prereqState.hasCustomers && (
                  <span className="block">
                    · Add a customer under <strong>CRM → Customers</strong>.
                  </span>
                )}
                {!prereqState.hasProducts && (
                  <span className="block">
                    · Add a product under <strong>Inventory → Products</strong>.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <AlertDialogCancel type="button">Close</AlertDialogCancel>
              {!prereqState.hasCustomers && (
                <Button asChild type="button">
                  <Link href="/dashboard/crm/customers">Customers</Link>
                </Button>
              )}
              {!prereqState.hasProducts && (
                <Button
                  asChild
                  type="button"
                  variant={prereqState.hasCustomers ? 'default' : 'secondary'}
                >
                  <Link href="/dashboard/inventory/products">Products</Link>
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </OperationsPageLayout>
    </ErrorBoundary>
  );
}
