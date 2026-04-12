'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type Equipment } from '@/lib/api/workshop';
import { ArrowLeft, Wrench, Clock, History, Bell } from 'lucide-react';

interface ReminderRecord {
  id: string;
  reminder_type: string;
  scheduled_send_at: string;
  status: string;
}

interface ServiceRecord {
  id: string;
  service_date: string;
  service_type: string;
  technician: string | null;
  hours_at_service: number | null;
  next_service_date: string | null;
  notes: string | null;
}

interface BookingRecord {
  id: string;
  booking_number: string;
  scheduled_date: string;
  status: string;
  location: string;
}

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [serviceHistory, setServiceHistory] = useState<ServiceRecord[]>([]);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState('');
  const [updatingHours, setUpdatingHours] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await workshopApi.getEquipment(id);
      setEquipment(data.equipment);
      setServiceHistory(data.service_history as ServiceRecord[]);
      setReminders(data.reminders as ReminderRecord[]);
      setBookings(data.bookings as BookingRecord[]);
      setHours(String(data.equipment.current_hours));
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdateHours() {
    const h = parseFloat(hours);
    if (isNaN(h)) return;
    setUpdatingHours(true);
    try {
      await workshopApi.updateHours(id, h);
      toast({ title: 'Hours updated' });
      load();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setUpdatingHours(false);
    }
  }

  if (loading) return <div className="text-muted-foreground p-6">Loading...</div>;
  if (!equipment) return <div className="p-6">Equipment not found.</div>;

  const warrantyValid = equipment.warranty_expiry
    ? new Date(equipment.warranty_expiry) > new Date()
    : false;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {equipment.make} {equipment.model}
          </h1>
          <p className="text-muted-foreground font-mono text-sm">{equipment.serial_number}</p>
        </div>
        <Badge
          className="ml-auto"
          variant={equipment.status === 'retired' ? 'secondary' : 'default'}
        >
          {equipment.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Machine Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Machine Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Make</span>
              <span>{equipment.make}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model</span>
              <span>{equipment.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Year</span>
              <span>{equipment.year || '\u2014'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="capitalize">{equipment.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Warranty</span>
              <span className={warrantyValid ? 'text-green-600' : 'text-red-500'}>
                {equipment.warranty_expiry
                  ? `${warrantyValid ? 'Valid until' : 'Expired'} ${new Date(equipment.warranty_expiry).toLocaleDateString()}`
                  : '\u2014'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Service Intervals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Service Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="bg-muted/50 rounded p-3">
              <div className="mb-1 font-medium">Interval</div>
              <div className="text-muted-foreground">
                {equipment.interval_months ? `Every ${equipment.interval_months} months` : '\u2014'}
                {equipment.interval_months && equipment.interval_hours ? ' OR ' : ''}
                {equipment.interval_hours
                  ? `${equipment.interval_hours}h \u2014 whichever comes first`
                  : ''}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next Service</span>
              <span>
                {equipment.next_service_date
                  ? new Date(equipment.next_service_date).toLocaleDateString()
                  : '\u2014'}
              </span>
            </div>
            {equipment.next_service_hours && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next at Hours</span>
                <span>{equipment.next_service_hours.toFixed(0)}h</span>
              </div>
            )}
            {/* Hours Update */}
            <div className="flex items-center gap-2 border-t pt-2">
              <span className="text-muted-foreground shrink-0">Current Hours</span>
              <Input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="h-8 w-24 text-sm"
              />
              <Button size="sm" onClick={handleUpdateHours} disabled={updatingHours}>
                {updatingHours ? 'Saving...' : 'Update'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Reminders */}
      {reminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Active Reminders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b py-1 text-sm last:border-0"
                >
                  <span className="capitalize">{r.reminder_type.replace('_', ' ')} reminder</span>
                  <span className="text-muted-foreground">
                    {new Date(r.scheduled_send_at).toLocaleDateString()}
                  </span>
                  <Badge variant={r.status === 'sent' ? 'secondary' : 'default'}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Service History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {serviceHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm">No service history recorded.</p>
          ) : (
            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Technician</th>
                    <th className="px-3 py-2 text-left">Hours</th>
                    <th className="px-3 py-2 text-left">Next Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {serviceHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">{new Date(h.service_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 capitalize">{h.service_type}</td>
                      <td className="px-3 py-2">{h.technician || '\u2014'}</td>
                      <td className="px-3 py-2">{h.hours_at_service?.toFixed(0) ?? '\u2014'}h</td>
                      <td className="px-3 py-2">
                        {h.next_service_date
                          ? new Date(h.next_service_date).toLocaleDateString()
                          : '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Bookings */}
      {bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" /> Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between border-b py-2 text-sm last:border-0"
                >
                  <span className="font-mono font-medium">{b.booking_number}</span>
                  <span className="text-muted-foreground">
                    {new Date(b.scheduled_date).toLocaleDateString()}
                  </span>
                  <span className="capitalize">{b.location}</span>
                  <Badge>{b.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
