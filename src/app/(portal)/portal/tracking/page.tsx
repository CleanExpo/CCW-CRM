'use client';

import { useEffect, useState } from 'react';
import { Truck, MapPin, Clock, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';

interface TrackingEvent {
  event_id: string;
  order_id: string;
  order_number: string;
  tracking_number: string;
  carrier: string;
  status: string;
  location: string;
  timestamp: string;
  description: string;
}

interface TrackingResponse {
  tracking: TrackingEvent[];
  total: number;
}

export default function PortalTrackingPage() {
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<TrackingResponse>('/api/portal/tracking');
        setData(res);
      } catch {
        /* fallback — tracking stays empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading tracking…
      </div>
    );
  }

  const events = data?.tracking ?? [];

  // Group by tracking number for display
  const grouped = events.reduce<Record<string, TrackingEvent[]>>((acc, evt) => {
    const key = evt.tracking_number;
    if (!acc[key]) acc[key] = [];
    acc[key].push(evt);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Shipment Tracking</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {events.length === 0
            ? 'No active shipments'
            : `${Object.keys(grouped).length} active shipment${Object.keys(grouped).length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Truck className="mb-4 h-12 w-12 text-slate-300" />
            <p className="font-medium text-slate-700">No active shipments</p>
            <p className="mt-1 text-sm text-slate-500">
              Shipment tracking will appear here once your order has been dispatched.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([trackingNumber, evts]) => {
            const latest = evts[0];
            const isDelivered = latest?.status?.toLowerCase().includes('delivered');
            return (
              <Card key={trackingNumber}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-50 p-2">
                        <Truck className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          Order {latest?.order_number}
                        </CardTitle>
                        <p className="font-mono text-xs text-slate-500">{trackingNumber}</p>
                      </div>
                    </div>
                    <Badge variant={isDelivered ? 'secondary' : 'default'}>
                      {latest?.carrier} · {latest?.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <ol className="relative border-l border-slate-200 pl-4">
                    {evts.map((evt, idx) => (
                      <li key={evt.event_id} className={`mb-4 ${idx === evts.length - 1 ? '' : ''}`}>
                        <div className="absolute -left-1.5 mt-1.5 flex h-3 w-3 items-center justify-center rounded-full border border-white bg-blue-500">
                          {evt.status.toLowerCase().includes('delivered') ? (
                            <CheckCircle className="h-2 w-2 text-white" />
                          ) : (
                            <Clock className="h-2 w-2 text-white" />
                          )}
                        </div>
                        <div className="ml-2">
                          <p className="text-sm font-medium text-slate-800">{evt.status}</p>
                          <p className="text-xs text-slate-500">{evt.description}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                            <MapPin className="h-3 w-3" />
                            <span>{evt.location}</span>
                            <span>·</span>
                            <span>
                              {new Date(evt.timestamp).toLocaleString('en-AU', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
