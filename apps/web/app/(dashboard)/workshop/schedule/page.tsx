'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type WorkshopBooking } from '@/lib/api/workshop';
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-orange-100 text-orange-700',
};

function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay() + 1); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function WorkshopSchedulePage() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<WorkshopBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('');
  const [weekStart, setWeekStart] = useState(new Date());
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dateFrom = weekDates[0].toISOString();
      const dateTo = new Date(weekDates[6].getTime() + 86400000).toISOString();
      const data = await workshopApi.listBookings({
        location: location || undefined,
        date_from: dateFrom,
        date_to: dateTo,
        page_size: 100,
      });
      setBookings(data.items);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [location, weekDates, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function bookingsForDay(date: Date): WorkshopBooking[] {
    return bookings.filter((b) => {
      const bd = new Date(b.scheduled_date);
      return bd.toDateString() === date.toDateString();
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workshop Schedule</h1>
          <p className="text-muted-foreground">Manage bookings across all workshop locations</p>
        </div>
        <div className="flex gap-2">
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Locations</option>
            <option value="brisbane">Brisbane</option>
            <option value="sydney">Sydney</option>
            <option value="melbourne">Melbourne</option>
          </select>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Booking
          </Button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">
          {weekDates[0].toLocaleDateString([], { month: 'long', day: 'numeric' })} –{' '}
          {weekDates[6].toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
        <Button variant="outline" size="sm" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(new Date())}>
          Today
        </Button>
      </div>

      {/* Week Grid */}
      {loading ? (
        <div className="text-muted-foreground">Loading bookings...</div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const dayBookings = bookingsForDay(date);
            return (
              <div
                key={date.toISOString()}
                className={`min-h-[120px] rounded-lg border p-2 ${isToday ? 'border-primary bg-primary/5' : ''}`}
              >
                <div
                  className={`mb-2 text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {date.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
                </div>
                {dayBookings.length === 0 ? (
                  <div className="text-muted-foreground/50 text-xs">Free</div>
                ) : (
                  <div className="space-y-1">
                    {dayBookings.map((b) => (
                      <div
                        key={b.id}
                        className={`rounded px-1 py-0.5 text-xs ${STATUS_COLORS[b.status] || 'bg-gray-100'}`}
                      >
                        <div className="font-mono">{b.booking_number}</div>
                        <div className="capitalize">{b.location}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Booking List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Bookings This Week ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-muted-foreground text-sm">No bookings this week.</p>
          ) : (
            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Booking #</th>
                    <th className="px-3 py-2 text-left">Date / Time</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono font-medium">{b.booking_number}</td>
                      <td className="px-3 py-2">
                        {new Date(b.scheduled_date).toLocaleDateString()}{' '}
                        {new Date(b.scheduled_date).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2 capitalize">{b.location}</td>
                      <td className="px-3 py-2">
                        <Badge className={STATUS_COLORS[b.status] || ''}>
                          {b.status.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
