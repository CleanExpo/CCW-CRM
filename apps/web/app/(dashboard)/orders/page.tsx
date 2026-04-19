'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { OrderStatusBadge } from '@/components/ui/order-status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderForm } from './components/OrderForm';
import { DeleteOrderDialog } from './components/DeleteOrderDialog';
import { BulkDeleteOrdersDialog } from './components/BulkDeleteOrdersDialog';
import { OrderDetailDialog } from './components/OrderDetailDialog';
import { Pencil, Trash2, Plus, Eye, Download, Copy, FileText } from 'lucide-react';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { format, formatDistanceToNow } from 'date-fns';
import { useOrders } from '@/lib/hooks/use-orders';

export default function OrdersPage() {
  const {
    orders,
    total,
    totalPages,
    loading,
    lastUpdated,
    page,
    pageSize,
    setPage,
    setPageSize,
    formOpen,
    setFormOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    bulkDeleteDialogOpen,
    setBulkDeleteDialogOpen,
    detailDialogOpen,
    setDetailDialogOpen,
    selectedOrder,
    selectedOrderIds,
    handleAddOrder,
    handleEditOrder,
    handleDuplicateOrder,
    handleDeleteOrder,
    handleViewDetails,
    handleExport,
    handleExportPDF,
    handleToggleSelectOrder,
    handleToggleSelectAll,
    handleBulkDelete,
    handleGenerateInvoice,
    handleSuccess,
  } = useOrders();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipment Orders</h1>
          <p className="text-muted-foreground">
            {selectedOrderIds.length > 0
              ? `${selectedOrderIds.length} selected`
              : 'Manage sales orders and fulfillment'}
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
              <CardTitle>Sales Orders</CardTitle>
              <CardDescription>
                {total} orders in system
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
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-lg font-medium">No orders found</p>
              <p className="text-muted-foreground mt-2 text-sm">
                Create your first order to get started.
              </p>
              <Button onClick={handleAddOrder} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Order
              </Button>
            </div>
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
  );
}
