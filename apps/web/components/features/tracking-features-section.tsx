"use client";

import { MapPin, MessageCircle, Activity } from "lucide-react";
import DottedMap from "dotted-map";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

// Initialize dotted map
const map = new DottedMap({ height: 60, grid: "diagonal" });

// Sample shipment locations
const shipmentLocations = [
  { lat: -33.8688, lng: 151.2093, city: "Sydney", country: "AU", status: "delivered" },
  { lat: -37.8136, lng: 144.9631, city: "Melbourne", country: "AU", status: "in-transit" },
  { lat: -27.4698, lng: 153.0251, city: "Brisbane", country: "AU", status: "in-transit" },
  { lat: -31.9505, lng: 115.8605, city: "Perth", country: "AU", status: "pending" },
];

// Add pins to map
shipmentLocations.forEach((location) => {
  map.addPin({
    lat: location.lat,
    lng: location.lng,
    svgOptions: { color: "#3b82f6", radius: 0.4 },
  });
});

const points = map.getPoints();

const svgOptions = {
  backgroundColor: "transparent",
  color: "currentColor",
  radius: 0.22,
};

interface TrackingMapProps {
  className?: string;
}

const TrackingMap = ({ className }: TrackingMapProps) => {
  const viewBox = `0 0 ${map.image.width} ${map.image.height}`;

  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={{ background: svgOptions.backgroundColor }}
    >
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={svgOptions.radius}
          fill={svgOptions.color}
          className="text-muted-foreground/30"
        />
      ))}
      {/* Highlight shipment pins */}
      {shipmentLocations.map((location, idx) => {
        const pin = map.getPin({ lat: location.lat, lng: location.lng });
        if (!pin) return null;

        const pinColor =
          location.status === "delivered"
            ? "#22c55e"
            : location.status === "in-transit"
            ? "#3b82f6"
            : "#f59e0b";

        return (
          <g key={idx}>
            <circle cx={pin.x} cy={pin.y} r={0.6} fill={pinColor} opacity={0.3} />
            <circle cx={pin.x} cy={pin.y} r={0.4} fill={pinColor} />
          </g>
        );
      })}
    </svg>
  );
};

interface ActivityItem {
  time: string;
  location: string;
  status: string;
  statusColor: string;
}

const recentActivity: ActivityItem[] = [
  { time: "2 hours ago", location: "Sydney, AU", status: "Delivered", statusColor: "text-green-500" },
  { time: "5 hours ago", location: "Melbourne, AU", status: "Out for delivery", statusColor: "text-blue-500" },
  { time: "1 day ago", location: "Brisbane, AU", status: "In transit", statusColor: "text-blue-500" },
  { time: "2 days ago", location: "Perth, AU", status: "Processing", statusColor: "text-amber-500" },
];

export default function TrackingFeaturesSection() {
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Real-time Map Tracking */}
      <Card className="p-6 border-border">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">Real-time Location Tracking</span>
          </div>

          <h3 className="text-2xl font-semibold">
            Track Shipments Across Australia & New Zealand
          </h3>

          <p className="text-muted-foreground">
            Monitor all active deliveries in real-time with precise location updates and estimated arrival times.
          </p>
        </div>

        {/* Map */}
        <div className="relative mt-6 rounded-lg overflow-hidden border border-border bg-muted/20">
          <div className="absolute inset-0 z-10 m-auto size-fit pointer-events-none">
            <div className="relative flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium shadow-lg">
              <span className="text-lg">🚚</span>
              <div>
                <div className="font-semibold">Active Shipment</div>
                <div className="text-muted-foreground">Sydney → Melbourne</div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden min-h-[300px] p-4">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90 z-[1]" />
            <TrackingMap className="w-full h-full" />
          </div>
        </div>

        {/* Location Pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {shipmentLocations.map((location, idx) => {
            const statusColors = {
              delivered: "bg-green-500/10 text-green-500 border-green-500/20",
              "in-transit": "bg-blue-500/10 text-blue-500 border-blue-500/20",
              pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
            };

            return (
              <Badge
                key={idx}
                variant="outline"
                className={`${statusColors[location.status as keyof typeof statusColors]} cursor-pointer hover:scale-105 transition-transform`}
                onClick={() => setSelectedShipment(location.city)}
              >
                {location.city}
              </Badge>
            );
          })}
        </div>
      </Card>

      {/* Support Chat & Activity Feed */}
      <div className="space-y-6">
        {/* Chat Interface */}
        <Card className="p-6 border-border">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Customer Support Chat</span>
            </div>

            <h3 className="text-2xl font-semibold">
              Instant Support for Delivery Questions
            </h3>

            <div className="space-y-4 mt-6">
              {/* Customer Message */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex justify-center items-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                    C
                  </span>
                  <span className="text-xs text-muted-foreground">Customer • 2 min ago</span>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm max-w-[80%]">
                  Where is my shipment #SH-2024-001? It was supposed to arrive today.
                </div>
              </div>

              {/* Support Response */}
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">Support • Just now</span>
                  <span className="flex justify-center items-center w-6 h-6 rounded-full bg-brand-primary text-xs font-medium text-white">
                    S
                  </span>
                </div>
                <div className="rounded-lg bg-brand-primary/90 p-3 text-sm text-white max-w-[80%]">
                  Your shipment is currently in Melbourne and will arrive by 5 PM today. You can track it in real-time on our shipment tracking page.
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Activity Feed */}
        <Card className="p-6 border-border">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">Recent Activity</span>
            </div>

            <h3 className="text-xl font-semibold">Delivery Updates</h3>

            <div className="space-y-3 mt-4">
              {recentActivity.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${item.statusColor.replace('text-', 'bg-')} mt-1.5`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-medium ${item.statusColor}`}>
                        {item.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
