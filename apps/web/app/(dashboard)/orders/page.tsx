"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderForm } from "./components/OrderForm";
import { DeleteOrderDialog } from "./components/DeleteOrderDialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Order } from "./types";

interface PaginatedResponse {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending: "outline",
  confirmed: "default",
  processing: "default",
  shipped: "default",
  delivered: "default",
  cancelled: "destructive",
};

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  async function loadOrders() {
    setLoading(true);
    try {
      const response = await apiClient.get<any>(
        "/api/orders?page=1&page_size=50"
      );

      // Map API response to frontend format
      const mappedOrders = response.items.map((order: any) => ({
        ...order,
        customer_name: order.customer_name || "Unknown Customer",
        item_count: order.items?.length || 0,
      }));

      setOrders(mappedOrders);
      setTotal(response.total);
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
  }, []);

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
      console.error("Failed to load order details:", error);
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

  const handleSuccess = () => {
    loadOrders();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Manage sales orders and fulfillment</p>
        </div>
        <Button onClick={handleAddOrder}>
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
      </div>

      <Card>
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                No orders found
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Create your first order to get started.
              </p>
              <Button onClick={handleAddOrder} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Order
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[order.status] || "outline"}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.item_count}</TableCell>
                    <TableCell className="font-semibold">${order.total}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(order.order_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditOrder(order)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOrder(order)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OrderForm
        order={selectedOrder}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleSuccess}
      />

      <DeleteOrderDialog
        order={selectedOrder}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
