import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusTimeline } from "@/components/portal/OrderStatusTimeline";
import { Package, ArrowRight } from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total: number;
  tracking_number?: string;
  carrier_name?: string;
  shipped_date?: string;
  estimated_delivery_date?: string;
  customer_id: string;
}

async function getCustomerOrders(): Promise<Order[]> {
  // In a real implementation, you would:
  // 1. Get customer_id from session cookie
  // 2. Call backend API to fetch customer's orders
  // For now, return mock data

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("portal_session");

  if (!sessionCookie) {
    redirect("/portal/auth/login");
  }

  // Mock data - replace with actual API call
  // const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/portal/orders`, {
  //   headers: {
  //     Cookie: `portal_session=${sessionCookie.value}`,
  //   },
  // });
  // return await response.json();

  return [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      order_number: "ORD-2026-001",
      order_date: "2026-01-10T09:30:00",
      status: "shipped",
      total: 1247.50,
      tracking_number: "AP123456789AU",
      carrier_name: "Australia Post",
      shipped_date: "2026-01-11T14:00:00",
      estimated_delivery_date: "2026-01-14T16:00:00",
      customer_id: "customer-123",
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440002",
      order_number: "ORD-2026-005",
      order_date: "2026-01-08T11:15:00",
      status: "processing",
      total: 3542.00,
      customer_id: "customer-123",
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440003",
      order_number: "ORD-2025-234",
      order_date: "2025-12-15T08:45:00",
      status: "delivered",
      total: 895.25,
      tracking_number: "ST987654321",
      carrier_name: "StarTrack",
      shipped_date: "2025-12-16T10:00:00",
      estimated_delivery_date: "2025-12-20T15:30:00",
      customer_id: "customer-123",
    },
  ];
}

function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    processing: "bg-purple-100 text-purple-800",
    shipped: "bg-indigo-100 text-indigo-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return statusColors[status] || "bg-gray-100 text-gray-800";
}

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function OrderCard({ order }: { order: Order }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{order.order_number}</CardTitle>
            <CardDescription className="mt-1">
              Ordered on {formatDate(order.order_date)}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(order.status)}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Order Total */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Order Total:</span>
            <span className="text-lg font-semibold">{formatCurrency(order.total)}</span>
          </div>

          {/* Tracking Information */}
          {order.tracking_number && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Tracking Number:</p>
              <p className="text-lg font-mono font-semibold text-gray-900">
                {order.tracking_number}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{order.carrier_name}</p>
            </div>
          )}

          {/* Status Timeline */}
          <OrderStatusTimeline order={order} />

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/portal/orders/${order.id}`}>
                View Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {order.tracking_number && (
              <Button asChild className="flex-1">
                <Link href={`/portal/orders/${order.id}/tracking`}>
                  <Package className="mr-2 h-4 w-4" />
                  Track Package
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function PortalOrdersPage() {
  const orders = await getCustomerOrders();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Orders</h1>
        <p className="text-muted-foreground">
          Track your orders and view delivery information
        </p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              No orders yet
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Your order history will appear here once you place an order
            </p>
            <Button asChild>
              <Link href="/portal">Browse Products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
