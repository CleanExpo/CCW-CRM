import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusTimeline } from "@/components/portal/OrderStatusTimeline";
import { ArrowLeft, Package, MapPin, Calendar, DollarSign } from "lucide-react";

interface OrderItem {
  id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

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
  fulfillment_location?: string;
  notes?: string;
  items: OrderItem[];
}

async function getOrder(orderId: string): Promise<Order | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("portal_session");

  if (!sessionCookie) {
    redirect("/portal/auth/login");
  }

  // Mock data - replace with actual API call
  // const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/portal/orders/${orderId}`, {
  //   headers: {
  //     Cookie: `portal_session=${sessionCookie.value}`,
  //   },
  // });
  // if (!response.ok) return null;
  // return await response.json();

  // Mock order data
  if (orderId === "550e8400-e29b-41d4-a716-446655440001") {
    return {
      id: orderId,
      order_number: "ORD-2026-001",
      order_date: "2026-01-10T09:30:00",
      status: "shipped",
      total: 1247.50,
      tracking_number: "AP123456789AU",
      carrier_name: "Australia Post",
      shipped_date: "2026-01-11T14:00:00",
      estimated_delivery_date: "2026-01-14T16:00:00",
      fulfillment_location: "Brisbane",
      notes: "Please deliver to rear entrance",
      items: [
        {
          id: "1",
          product_name: "Heavy Duty Power Drill",
          product_sku: "SKU-001",
          quantity: 2,
          unit_price: 350.00,
          subtotal: 700.00,
        },
        {
          id: "2",
          product_name: "Safety Helmet - Yellow",
          product_sku: "SKU-042",
          quantity: 5,
          unit_price: 45.50,
          subtotal: 227.50,
        },
        {
          id: "3",
          product_name: "Extension Cord 20m",
          product_sku: "SKU-105",
          quantity: 3,
          unit_price: 106.67,
          subtotal: 320.00,
        },
      ],
    };
  }

  return null;
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

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await getOrder(params.id);

  if (!order) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Back Button */}
      <Button asChild variant="ghost" className="mb-6">
        <Link href="/portal/orders">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-bold">{order.order_number}</h1>
          <Badge className={getStatusColor(order.status)}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Ordered on {formatDate(order.order_date)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>
                {order.items.length} {order.items.length === 1 ? "item" : "items"} in this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">SKU: {item.product_sku}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Quantity: {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>
                    {index < order.items.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}

                <Separator className="my-4" />

                {/* Order Total */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-semibold">Order Total (inc. GST):</span>
                  <span className="text-2xl font-bold">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Delivery Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Tracking Information */}
          {order.tracking_number && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tracking Number</p>
                  <p className="font-mono font-semibold text-sm">{order.tracking_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Carrier</p>
                  <p className="font-medium">{order.carrier_name}</p>
                </div>
                {order.estimated_delivery_date && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Estimated Delivery</p>
                    <p className="font-medium">{formatDate(order.estimated_delivery_date)}</p>
                  </div>
                )}
                <Button asChild className="w-full">
                  <Link href={`/portal/orders/${order.id}/tracking`}>
                    <Package className="mr-2 h-4 w-4" />
                    Track Package
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Order Date</p>
                  <p className="text-sm text-muted-foreground">{formatDate(order.order_date)}</p>
                </div>
              </div>
              {order.fulfillment_location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Shipped From</p>
                    <p className="text-sm text-muted-foreground">{order.fulfillment_location}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Total</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(order.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusTimeline order={order} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
