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
import { Search, Download, BarChart3, MessageSquare, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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
      const csvContent = [
        headers.join(','),
        ...items.map((item: Record<string, unknown>) =>
          headers
            .map((header) => {
              const value = item[header];
              // Escape commas and quotes in values
              if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value || '';
            })
            .join(',')
        ),
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Export completed successfully');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to export data');
    }
  }

  return (
    <div className="container px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Form Submissions</h1>
        <p className="text-muted-foreground">
          View and manage contact submissions and demo requests from the portal
        </p>
      </div>

      {/* Statistics Cards */}
      {loading ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : statistics ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <BarChart3 className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total_submissions}</div>
              <p className="text-muted-foreground text-xs">
                {statistics.contact_submissions.total} contact + {statistics.demo_requests.total}{' '}
                demo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
              <Calendar className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.contact_submissions.recent_24h + statistics.demo_requests.recent_24h}
              </div>
              <p className="text-muted-foreground text-xs">Recent submissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New/Pending</CardTitle>
              <MessageSquare className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.contact_submissions.new + statistics.demo_requests.pending}
              </div>
              <p className="text-muted-foreground text-xs">Awaiting response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.contact_submissions.closed + statistics.demo_requests.completed}
              </div>
              <p className="text-muted-foreground text-xs">Resolved submissions</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Filters and Actions */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              type="search"
              placeholder="Search submissions..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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

        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="contact">
            Contact Submissions ({statistics?.contact_submissions.total || 0})
          </TabsTrigger>
          <TabsTrigger value="demo">
            Demo Requests ({statistics?.demo_requests.total || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Form Submissions</CardTitle>
              <CardDescription>Messages from customers via the Contact Us form</CardDescription>
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
          <Card>
            <CardHeader>
              <CardTitle>Demo Requests</CardTitle>
              <CardDescription>Demo requests from potential customers</CardDescription>
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
    </div>
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
