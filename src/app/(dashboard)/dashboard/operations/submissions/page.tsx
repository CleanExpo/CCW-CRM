'use client';

import { Suspense, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContactSubmissionsTable } from './components/ContactSubmissionsTable';
import { DemoRequestsTable } from './components/DemoRequestsTable';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { convertToCSV, downloadCSV } from '@/lib/utils/csv-export';
import {
  Search,
  Download,
  BarChart3,
  MessageSquare,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  OperationsPageHeader,
  OperationsPageLayout,
} from '@/components/operations/OperationsPageHeader';
import { opCardClass, opHeroSurfaceClass, opInsetClass } from '@/lib/operations/ui';
import { cn } from '@/lib/utils';

interface Statistics {
  contact_submissions: {
    new: number;
    read: number;
    responded: number;
    closed: number;
    total: number;
    recent_24h: number;
  };
  demo_requests: {
    pending: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    total: number;
    recent_24h: number;
  };
  total_submissions: number;
}

export default function SubmissionsPage() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('contact');

  useEffect(() => {
    fetchStatistics();
  }, []);

  async function fetchStatistics() {
    setLoading(true);
    try {
      const stats = await apiClient.get<Statistics>('/api/submissions/statistics');
      setStatistics(stats);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const type = activeTab === 'contact' ? 'contact-submissions' : 'demo-requests';
      const data = await apiClient.get<{ items: Record<string, unknown>[] }>(
        `/api/${type}?page=1&page_size=1000`
      );

      // Convert to CSV
      const items = data.items || [];
      if (items.length === 0) {
        toast.error('No data to export');
        return;
      }

      const headers = Object.keys(items[0]);
      const csv = convertToCSV(items as Record<string, unknown>[], headers);
      downloadCSV(csv, `${type}-${new Date().toISOString().split('T')[0]}.csv`);

      toast.success('Export completed successfully');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to export data');
    }
  }

  return (
    <OperationsPageLayout className="space-y-6 py-2">
      <OperationsPageHeader
        accent="horizon"
        title="Form submissions"
        description="Review portal contact messages and demo requests. Export for sales follow-up or CRM import."
        icon={ClipboardCheck}
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : statistics ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className={cn(opCardClass, opHeroSurfaceClass, 'overflow-hidden')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total submissions</CardTitle>
              <div className="rounded-lg bg-primary/15 p-2 text-primary ring-1 ring-primary/20">
                <BarChart3 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-3xl font-bold tabular-nums">
                {statistics.total_submissions}
              </div>
              <p className="text-muted-foreground mt-1 text-xs dark:text-foreground/65">
                {statistics.contact_submissions.total} contact · {statistics.demo_requests.total}{' '}
                demo
              </p>
            </CardContent>
          </Card>

          <Card className={cn(opCardClass, opHeroSurfaceClass, 'overflow-hidden')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last 24 hours</CardTitle>
              <div className="rounded-lg bg-sky-500/15 p-2 text-sky-600 ring-1 ring-sky-500/25 dark:text-sky-400">
                <Calendar className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-3xl font-bold tabular-nums">
                {statistics.contact_submissions.recent_24h + statistics.demo_requests.recent_24h}
              </div>
              <p className="text-muted-foreground mt-1 text-xs dark:text-foreground/65">
                New entries in the last day
              </p>
            </CardContent>
          </Card>

          <Card className={cn(opCardClass, opHeroSurfaceClass, 'overflow-hidden')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs attention</CardTitle>
              <div className="rounded-lg bg-amber-500/15 p-2 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-400">
                <MessageSquare className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-3xl font-bold tabular-nums">
                {statistics.contact_submissions.new + statistics.demo_requests.pending}
              </div>
              <p className="text-muted-foreground mt-1 text-xs dark:text-foreground/65">
                New contacts + pending demos
              </p>
            </CardContent>
          </Card>

          <Card className={cn(opCardClass, opHeroSurfaceClass, 'overflow-hidden')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-3xl font-bold tabular-nums">
                {statistics.contact_submissions.closed + statistics.demo_requests.completed}
              </div>
              <p className="text-muted-foreground mt-1 text-xs dark:text-foreground/65">
                Closed or finished demos
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div
        className={cn(
          'flex flex-col gap-4 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between',
          opInsetClass
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4 dark:text-foreground/50" />
            <Input
              type="search"
              placeholder="Search by name, email, or company…"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {activeTab === 'contact' ? (
                <>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleExport} variant="outline" className="shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-11 w-full max-w-lg grid-cols-2 rounded-xl border border-border/50 bg-muted/40 p-1 dark:bg-muted/25">
          <TabsTrigger
            value="contact"
            className="rounded-lg data-[state=active]:shadow-sm"
          >
            Contact ({statistics?.contact_submissions.total || 0})
          </TabsTrigger>
          <TabsTrigger value="demo" className="rounded-lg data-[state=active]:shadow-sm">
            Demo ({statistics?.demo_requests.total || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="mt-6">
          <Card className={cn(opCardClass, opHeroSurfaceClass)}>
            <CardHeader>
              <CardTitle>Contact form</CardTitle>
              <CardDescription className="dark:text-foreground/70">
                Messages from the public contact form
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<TableSkeleton />}>
                <ContactSubmissionsTable
                  searchQuery={searchQuery}
                  statusFilter={statusFilter === 'all' ? undefined : statusFilter}
                  onDataChange={fetchStatistics}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demo" className="mt-6">
          <Card className={cn(opCardClass, opHeroSurfaceClass)}>
            <CardHeader>
              <CardTitle>Demo requests</CardTitle>
              <CardDescription className="dark:text-foreground/70">
                Bookings and enquiries for product demos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<TableSkeleton />}>
                <DemoRequestsTable
                  searchQuery={searchQuery}
                  statusFilter={statusFilter === 'all' ? undefined : statusFilter}
                  onDataChange={fetchStatistics}
                />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </OperationsPageLayout>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
