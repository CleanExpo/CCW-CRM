import { useCallback, useEffect, useState } from 'react';
import { useSearchState } from '@/lib/hooks/use-search-state';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { exportOrdersToCSV, exportOrdersToPDF } from '@/lib/utils/csv-export';
import { invoicesApi } from '@/lib/api/invoices';
import type { Order } from '@/app/(dashboard)/orders/types';

interface PaginatedResponse {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export function useOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/orders?page=${page}&page_size=${pageSize}`
      );
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
      toast({ variant: 'destructive', title: 'Error', description: message });
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [page, pageSize, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleAddOrder = () => {
    setSelectedOrder(null);
    setFormOpen(true);
  };

  const handleEditOrder = async (order: Order) => {
    try {
      const fullOrder = await apiClient.get<Order>(`/api/orders/${order.id}`);
      setSelectedOrder(fullOrder);
      setFormOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load order details';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleDuplicateOrder = async (order: Order) => {
    try {
      const fullOrder = await apiClient.get<Order>(`/api/orders/${order.id}`);
      const orderCopy = {
        ...fullOrder,
        id: undefined,
        order_number: undefined,
        status: 'draft' as const,
        notes: fullOrder.notes
          ? `Copy of ${fullOrder.order_number}\n\n${fullOrder.notes}`
          : `Copy of ${fullOrder.order_number}`,
      };
      setSelectedOrder(orderCopy as unknown as Order);
      setFormOpen(true);
      toast({ title: 'Order Duplicated', description: 'Review and modify the copy before saving' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate order';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleDeleteOrder = (order: Order) => {
    setSelectedOrder(order);
    setDeleteDialogOpen(true);
  };

  const handleViewDetails = async (order: Order) => {
    try {
      const fullOrder = await apiClient.get<Order>(`/api/orders/${order.id}`);
      setSelectedOrder(fullOrder);
      setDetailDialogOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load order details';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleExport = () => {
    exportOrdersToCSV(orders);
    toast({ title: 'Export Successful', description: `Exported ${orders.length} orders to CSV` });
  };

  const handleExportPDF = () => {
    exportOrdersToPDF(orders);
    toast({ title: 'PDF Export', description: 'Print dialog opening…' });
  };

  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleToggleSelectAll = () => {
    setSelectedOrderIds(selectedOrderIds.length === orders.length ? [] : orders.map((o) => o.id));
  };

  const handleBulkDelete = () => setBulkDeleteDialogOpen(true);

  const handleGenerateInvoice = async (order: Order) => {
    try {
      const invoice = await invoicesApi.generateFromOrder(order.id);
      toast({
        title: 'Invoice Generated',
        description: 'Invoice created — redirecting to invoice.',
      });
      window.location.href = `/invoices/${invoice.id}`;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate invoice';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleSuccess = () => {
    loadOrders();
    setSelectedOrderIds([]);
  };

  return {
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
  };
}
