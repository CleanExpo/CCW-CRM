import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, Clock, CheckCircle2, Package, Truck } from "lucide-react";

interface TrackingEvent {
  status: string;
  status_detail: string;
  location: string;
  timestamp: string;
  description: string;
}

interface TrackingInfo {
  order_number: string;
  tracking_number: string;
  carrier_name: string;
  current_status: string;
  estimated_delivery: string;
  events: TrackingEvent[];
}

async function getTrackingInfo(orderId: string): Promise<TrackingInfo | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("portal_session");

  if (!sessionCookie) {
    redirect("/portal/auth/login");
  }

  // Mock data - replace with actual API call to backend
  // const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/portal/orders/${orderId}/tracking`, {
  //   headers: {
  //     Cookie: `portal_session=${sessionCookie.value}`,
  //   },
  // });
  // if (!response.ok) return null;
  // return await response.json();

  // Mock tracking data
  if (orderId === "550e8400-e29b-41d4-a716-446655440001") {
    return {
      order_number: "ORD-2026-001",
      tracking_number: "AP123456789AU",
      carrier_name: "Australia Post",
      current_status: "in_transit",
      estimated_delivery: "2026-01-14T16:00:00",
      events: [
        {
          status: "in_transit",
          status_detail: "Out for delivery",
          location: "Brisbane QLD 4000",
          timestamp: "2026-01-13T08:30:00",
          description: "Your package is out for delivery and should arrive today",
        },
        {
          status: "in_transit",
          status_detail: "Arrived at local facility",
          location: "Brisbane QLD 4000",
          timestamp: "2026-01-13T06:00:00",
          description: "Package arrived at local distribution centre",
        },
        {
          status: "in_transit",
          status_detail: "In transit",
          location: "Sydney NSW 2000",
          timestamp: "2026-01-12T14:30:00",
          description: "Package is in transit to destination",
        },
        {
          status: "picked_up",
          status_detail: "Picked up",
          location: "Brisbane QLD 4000",
          timestamp: "2026-01-11T14:00:00",
          description: "Package picked up by carrier",
        },
        {
          status: "label_created",
          status_detail: "Shipping label created",
          location: "Brisbane QLD 4000",
          timestamp: "2026-01-11T10:00:00",
          description: "Shipping label created, package awaiting pickup",
        },
      ],
    };
  }

  return null;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${day}/${month}/${year} at ${displayHours}:${minutes} ${ampm}`;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "delivered":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "out_for_delivery":
    case "in_transit":
      return <Truck className="h-5 w-5 text-blue-600" />;
    case "picked_up":
      return <Package className="h-5 w-5 text-indigo-600" />;
    default:
      return <MapPin className="h-5 w-5 text-gray-600" />;
  }
}

export default async function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tracking = await getTrackingInfo(id);

  if (!tracking) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Back Button */}
      <Button asChild variant="ghost" className="mb-6">
        <Link href={`/portal/orders/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Order
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Track Your Package</h1>
        <p className="text-muted-foreground">
          Order {tracking.order_number}
        </p>
      </div>

      <div className="grid gap-6">
        {/* Tracking Summary Card */}
        <Card className="border-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">Tracking Information</CardTitle>
                <CardDescription className="mt-2">
                  Carrier: {tracking.carrier_name}
                </CardDescription>
              </div>
              <Badge className="bg-blue-100 text-blue-800">
                {tracking.current_status.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tracking Number */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Tracking Number</p>
              <p className="text-2xl font-mono font-bold">{tracking.tracking_number}</p>
            </div>

            {/* Estimated Delivery */}
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <Clock className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">Estimated Delivery</p>
                <p className="text-lg font-semibold text-green-900">
                  {formatDateTime(tracking.estimated_delivery)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tracking Events */}
        <Card>
          <CardHeader>
            <CardTitle>Tracking History</CardTitle>
            <CardDescription>
              Detailed shipment progress and updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

              {/* Events */}
              <div className="space-y-6">
                {tracking.events.map((event, index) => (
                  <div key={index} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* Icon */}
                    <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-gray-200">
                      {getStatusIcon(event.status)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {event.status_detail}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        </div>
                      </div>

                      {/* Location and Time */}
                      <div className="flex flex-wrap gap-4 mt-3 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{event.location}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{formatDateTime(event.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">
                  Need help with your delivery?
                </h3>
                <p className="text-sm text-blue-800 mb-4">
                  If you have any questions about your shipment or need to make changes
                  to your delivery, please contact us.
                </p>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="bg-white">
                    <a href="mailto:support@ccw.com.au">Email Support</a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="bg-white">
                    <Link href="/portal/orders">View All Orders</Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
