'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api/client';
import { ServiceRequestForm } from './components/ServiceRequestForm';
import { DeleteServiceRequestDialog } from './components/DeleteServiceRequestDialog';
import { Pencil, Trash2, Plus, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type {
  ServiceRequest,
  PaginatedServiceRequestsResponse,
  ServiceStatus,
} from '@/lib/api/service-requests';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  submitted: 'secondary',
  under_review: 'outline',
  quote_sent: 'outline',
  approved: 'default',
  scheduled: 'default',
  in_progress: 'default',
  completed: 'default',
  cancelled: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  quote_sent: 'Quote Sent',
  approved: 'Approved',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  repair: 'Repair',
  maintenance: 'Maintenance',
  inspection: 'Inspection',
  installation: 'Installation',
  warranty: 'Warranty',
  other: 'Other',
};

export default function ServiceRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (debouncedSearch) query.set('search', debouncedSearch);
      if (statusFilter && statusFilter !== 'all')
        query.set('status', statusFilter as ServiceStatus);

      const response = await apiClient.get<PaginatedServiceRequestsResponse>(
        `/api/service-requests?${query.toString()}`
      );
      setRequests(response.items);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load service requests';
      toast({ variant: 'destructive', title: 'Error', description: message });
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAdd = () => {
    setSelectedRequest(null);
    setFormOpen(true);
  };

  const handleEdit = (request: ServiceRequest) => {
    setSelectedRequest(request);
    setFormOpen(true);
  };

  const handleDelete = (request: ServiceRequest) => {
    setSelectedRequest(request);
    setDeleteDialogOpen(true);
  };

  const handleSuccess = () => {
    loadRequests();
  };

  const formatCurrency = (amount: number | null) =>
    amount !== null ? `$${amount.toFixed(2)}` : '—';

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString('en-AU') : '—';

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Service Requests</h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Manage equipment repair and maintenance requests
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Service Request Queue</CardTitle>
            <CardDescription>{total} requests total</CardDescription>
            <div className="mt-4 flex flex-wrap gap-3">
              <Input
                placeholder="Search equipment or issue..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
              />
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="quote_sent">Quote Sent</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wrench className="text-muted-foreground mb-4 h-12 w-12" />
                <p className="text-muted-foreground text-lg font-medium">
                  No service requests found
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  {search || statusFilter !== 'all'
                    ? 'Try adjusting your search or filter.'
                    : 'Create your first service request to get started.'}
                </p>
                {!search && statusFilter === 'all' && (
                  <Button onClick={handleAdd} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    New Request
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Equipment</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Technician</th>
                      <th className="px-4 py-3 text-left font-medium">Scheduled</th>
                      <th className="px-4 py-3 text-right font-medium">Quote</th>
                      <th className="px-4 py-3 text-right font-medium">Approved</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr key={request.id} className="hover:bg-muted/30 border-b transition-colors">
                        <td className="px-4 py-3">
                          <Badge variant="outline">
                            {REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type}
                          </Badge>
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate font-medium">
                            {request.equipment_description.slice(0, 60)}
                            {request.equipment_description.length > 60 ? '...' : ''}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {request.issue_description.slice(0, 50)}
                            {request.issue_description.length > 50 ? '...' : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_COLORS[request.status] ?? 'secondary'}>
                            {STATUS_LABELS[request.status] ?? request.status}
                          </Badge>
                        </td>
                        <td className="text-muted-foreground px-4 py-3">
                          {request.assigned_technician || '—'}
                        </td>
                        <td className="text-muted-foreground px-4 py-3">
                          {formatDate(request.scheduled_date)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCurrency(request.quote_amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCurrency(request.approved_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(request)}
                              title="Edit Request"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(request)}
                              title="Delete Request"
                            >
                              <Trash2 className="text-destructive h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && totalPages > 1 && (
              <div className="text-muted-foreground mt-4 flex items-center justify-between text-sm">
                <span>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <ServiceRequestForm
          serviceRequest={selectedRequest}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={handleSuccess}
        />

        <DeleteServiceRequestDialog
          serviceRequest={selectedRequest}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onSuccess={handleSuccess}
        />
      </div>
    </ErrorBoundary>
  );
}
