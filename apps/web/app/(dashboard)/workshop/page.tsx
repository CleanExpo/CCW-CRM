'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { workshopApi, type DashboardData } from '@/lib/api/workshop';
import { CalendarDays, AlertTriangle, Bell, Wrench, Clock } from 'lucide-react';
import Link from 'next/link';

const LOCATIONS = ['all', 'brisbane', 'sydney', 'melbourne'];

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-orange-100 text-orange-800',
};

export default function WorkshopDashboardPage() {
  const { toast } = useToast();
  const [location, setLocation] = useState('all');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workshopApi.getDashboard(location === 'all' ? undefined : location);
      setDashboard(data);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load dashboard',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [location, toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workshop Dashboard</h1>
          <p className="text-muted-foreground">
            Truckmount service management across all locations
          </p>
        </div>
        <Link href={'/workshop/schedule' as any}>
          <Button>
            <CalendarDays className="mr-2 h-4 w-4" /> View Schedule
          </Button>
        </Link>
      </div>

      {/* Location Tabs */}
      <div className="flex gap-2">
        {LOCATIONS.map((loc) => (
          <button
            key={loc}
            onClick={() => setLocation(loc)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
              location === loc
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {loc === 'all' ? 'All Locations' : loc}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading dashboard...</div>
      ) : dashboard ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Today&apos;s Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.today.count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.this_week.booking_count}</div>
              </CardContent>
            </Card>
            <Card className={dashboard.overdue_equipment_count > 0 ? 'border-red-300' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
                  {dashboard.overdue_equipment_count > 0 && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  Overdue Equipment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl font-bold ${dashboard.overdue_equipment_count > 0 ? 'text-red-600' : ''}`}
                >
                  {dashboard.overdue_equipment_count}
                </div>
                {dashboard.overdue_equipment_count > 0 && (
                  <Link
                    href={'/workshop/equipment?overdue_only=true' as any}
                    className="text-xs text-red-500 hover:underline"
                  >
                    View overdue
                  </Link>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
                  <Bell className="h-4 w-4" /> Pending Reminders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.pending_reminders_count}</div>
                <Link
                  href={'/workshop/reminders' as any}
                  className="text-muted-foreground text-xs hover:underline"
                >
                  Manage
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Today's Jobs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Today&apos;s Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.today.bookings.length === 0 ? (
                <p className="text-muted-foreground text-sm">No jobs scheduled today.</p>
              ) : (
                <div className="space-y-2">
                  {dashboard.today.bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between border-b py-2 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Wrench className="text-muted-foreground h-4 w-4" />
                        <div>
                          <div className="text-sm font-medium">{booking.booking_number}</div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(booking.scheduled_date).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {' · '}
                            {booking.location}
                          </div>
                        </div>
                      </div>
                      <Badge className={STATUS_COLORS[booking.status] || ''}>
                        {booking.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming 30 Days Mini-Calendar */}
          {Object.keys(dashboard.upcoming_30_days).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Upcoming 30 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(dashboard.upcoming_30_days)
                    .sort()
                    .map(([date, count]) => (
                      <div
                        key={date}
                        className="bg-muted flex min-w-[48px] flex-col items-center rounded p-2"
                      >
                        <span className="text-muted-foreground text-xs">
                          {new Date(date).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
