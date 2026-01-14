"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderForm } from "./components/OrderForm";
import { QuickCustomerAdd } from "./components/QuickCustomerAdd";
import { DeleteOrderDialog } from "./components/DeleteOrderDialog";
import { BulkDeleteOrdersDialog } from "./components/BulkDeleteOrdersDialog";
import { BulkStatusUpdateDialog } from "./components/BulkStatusUpdateDialog";
import { OrderDetailDialog } from "./components/OrderDetailDialog";
import { BulkActionBar, BulkAction } from "@/components/bulk-operations/BulkActionBar";
import { BulkExportDialog } from "@/components/bulk-operations/BulkExportDialog";
import { Pencil, Trash2, Plus, Eye, Download, ShoppingCart, Clock, CheckCircle, Truck, Package as PackageIcon, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Order } from "./types";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { format } from "date-fns";
import { exportOrdersToCSV } from "@/lib/utils/csv-export";
import { useRealTimeOrders } from "@/hooks/use-real-time-orders";

interface PaginatedResponse {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const statusVariants: Record<string, "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "secondary"> = {
  draft: "secondary",
  pending: "pending",
  confirmed: "confirmed",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

const statusIcons: Record<string, any> = {
  draft: null,
  pending: Clock,
  confirmed: CheckCircle,
  processing: PackageIcon,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();

  // Enable real-time order updates via WebSocket
  useRealTimeOrders({
    showNotifications: true,
    onOrderCreated: () => loadOrders(),
    onOrderUpdated: () => loadOrders(),
    onOrderDeleted: () => loadOrders(),
    onOrderStatusChanged: () => loadOrders(),
  });

  async function loadOrders() {
    setLoading(true);
    try {
      const response = await apiClient.get<any>(
        `/api/orders?page=${page}&page_size=${pageSize}`
      );

      // Map API response to frontend format
      const mappedOrders = response.items.map((order: any) => ({
        ...order,
        customer_name: order.customer_name || "Unknown Customer",
        item_count: order.items?.length || 0,
      }));

      setOrders(mappedOrders);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: any) {
      console.error("Failed to load orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load orders",
      });
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [page, pageSize]);

  const handleAddOrder = () => {
    setSelectedOrder(null);
    setFormOpen(true);
  };

  const handleEditOrder = async (order: Order) => {
    // Fetch full order details including line items
    try {
      const fullOrder = await apiClient.get<any>(`/api/orders/${order.id}`);
      setSelectedOrder(fullOrder);
      setFormOpen(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load order details",
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
      const fullOrder = await apiClient.get<any>(`/api/orders/${order.id}`);
      setSelectedOrder(fullOrder);
      setDetailDialogOpen(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load order details",
      });
    }
  };

  const handleExport = () => {
    exportOrdersToCSV(orders);
    toast({
      title: "Export Successful",
      description: `Exported ${orders.length} orders to CSV`,
    });
  };

  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
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

  const handleBulkStatusUpdate = () => {
    setBulkStatusDialogOpen(true);
  };

  const handleBulkExport = () => {
    setBulkExportDialogOpen(true);
  };

  const handleBulkExportExecute = async (format: string, options: any) => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));

    if (format === "csv") {
      exportOrdersToCSV(selectedOrders);
    } else if (format === "json") {
      const dataStr = JSON.stringify(selectedOrders, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders-${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSuccess = () => {
    loadOrders();
    setSelectedOrderIds([]);
  };

  const handleCustomerCreated = (customer: { id: string; company_name: string }) => {
    setSelectedCustomerId(customer.id);
    toast({
      title: "Customer Added",
      description: `${customer.company_name} will be selected for this order.`,
    });
  };

  // Define bulk actions for the action bar
  const bulkActions: BulkAction[] = [
    {
      id: "update-status",
      label: "Update Status",
      icon: RefreshCw,
      variant: "default",
      onClick: handleBulkStatusUpdate,
    },
    {
      id: "export",
      label: "Export",
      icon: Download,
      variant: "outline",
      onClick: handleBulkExport,
    },
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: handleBulkDelete,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Orders
          </h1>
          <p className="text-muted-foreground">
            {selectedOrderIds.length > 0
              ? `${selectedOrderIds.length} selected`
              : "Manage sales orders and fulfillment"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={orders.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
          <Button onClick={handleAddOrder}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sales Orders</CardTitle>
              <CardDescription>
                {total} orders in system
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-brand-primary-100 p-4 mb-4 dark:bg-brand-primary-950">
                <ShoppingCart className="h-10 w-10 text-brand-primary-600 dark:text-brand-primary-400" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                No orders found
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Get started by creating your first sales order to track customer purchases.
              </p>
              <Button onClick={handleAddOrder} className="mt-6">
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
                  key: "select",
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
                  className: "w-12",
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
                  key: "order_number",
                  label: "Order #",
                  className: "font-mono text-sm font-medium",
                  render: (order) => order.order_number,
                },
                {
                  key: "customer",
                  label: "Customer",
                  render: (order) => order.customer_name,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (order) => {
                    const StatusIcon = statusIcons[order.status];
                    return (
                      <Badge variant={statusVariants[order.status] || "secondary"} icon={StatusIcon} className="capitalize">
                        {order.status}
                      </Badge>
                    );
                  },
                },
                {
                  key: "items",
                  label: "Items",
                  hideOnMobile: true,
                  render: (order) => order.item_count,
                },
                {
                  key: "total",
                  label: "Total",
                  className: "font-bold",
                  render: (order) => {
                    const colorClass =
                      order.status === "delivered" ? "text-success" :
                      order.status === "processing" || order.status === "shipped" ? "text-brand-primary-700 dark:text-brand-primary-400" :
                      order.status === "confirmed" ? "text-info" :
                      order.status === "cancelled" ? "text-error" :
                      "text-foreground";
                    return <span className={colorClass}>${order.total}</span>;
                  },
                },
                {
                  key: "order_date",
                  label: "Order Date",
                  className: "text-sm text-muted-foreground",
                  hideOnMobile: true,
                  render: (order) => format(new Date(order.order_date), "MMM dd, yyyy"),
                },
                {
                  key: "actions",
                  label: "Actions",
                  className: "text-right",
                  mobileLabel: "",
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
                          handleDeleteOrder(order);
                        }}
                        title="Delete Order"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
        onQuickAddClick={() => setQuickAddOpen(true)}
        selectedCustomerId={selectedCustomerId}
      />

      <QuickCustomerAdd
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onCustomerCreated={handleCustomerCreated}
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

      <BulkStatusUpdateDialog
        open={bulkStatusDialogOpen}
        onOpenChange={setBulkStatusDialogOpen}
        selectedOrderIds={selectedOrderIds}
        onSuccess={handleSuccess}
      />

      <BulkExportDialog
        open={bulkExportDialogOpen}
        onOpenChange={setBulkExportDialogOpen}
        selectedCount={selectedOrderIds.length}
        onExport={handleBulkExportExecute}
        entityName="orders"
        availableFormats={[
          { value: "csv", label: "CSV", description: "Comma-separated values" },
          { value: "json", label: "JSON", description: "JavaScript Object Notation" },
        ]}
        availableFields={[
          { key: "order_number", label: "Order Number", defaultChecked: true },
          { key: "customer_name", label: "Customer", defaultChecked: true },
          { key: "order_date", label: "Order Date", defaultChecked: true },
          { key: "status", label: "Status", defaultChecked: true },
          { key: "total", label: "Total", defaultChecked: true },
          { key: "item_count", label: "Item Count", defaultChecked: true },
        ]}
      />

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedOrderIds.length}
        totalCount={total}
        actions={bulkActions}
        onClearSelection={() => setSelectedOrderIds([])}
        onSelectAll={handleToggleSelectAll}
      />
    </div>
  );
}
