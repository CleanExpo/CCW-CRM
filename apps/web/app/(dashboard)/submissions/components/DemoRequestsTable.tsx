'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { SubmissionDetailDialog } from './SubmissionDetailDialog';
import { toast } from 'sonner';

interface DemoRequest {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  product_interest: string | null;
  preferred_date: string | null;
  notes: string | null;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  items: DemoRequest[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

interface DemoRequestsTableProps {
  searchQuery?: string;
  statusFilter?: string;
  onDataChange?: () => void;
}

export function DemoRequestsTable({
  searchQuery,
  statusFilter,
  onDataChange,
}: DemoRequestsTableProps) {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchDemoRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery, statusFilter]);

  async function fetchDemoRequests() {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/demo-requests?page=${page}&page_size=10`;
      if (statusFilter) {
        url += `&status_filter=${statusFilter}`;
      }
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const response = await apiClient.get<PaginatedResponse>(url);
      setData(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load demo requests');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(submissionId: string, newStatus: string) {
    try {
      await apiClient.patch(`/api/demo-requests/${submissionId}/status`, {
        status: newStatus,
      });
      toast.success('Status updated');
      fetchDemoRequests();
      onDataChange?.(); // Notify parent to refresh statistics
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  }

  function handleRowClick(submissionId: string) {
    setSelectedSubmissionId(submissionId);
    setDetailDialogOpen(true);
  }

  if (loading && !data) {
    return <div className="text-muted-foreground py-8 text-center">Loading demo requests...</div>;
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchDemoRequests} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <Building2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p className="text-lg font-medium">No demo requests yet</p>
        <p className="text-sm">Demo requests from potential customers will appear here</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((request) => (
                <TableRow
                  key={request.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleRowClick(request.id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="text-muted-foreground h-4 w-4" />
                      {request.company_name}
                    </div>
                  </TableCell>
                  <TableCell>{request.contact_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="text-muted-foreground h-4 w-4" />
                      {request.email}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={request.status}
                      onValueChange={(value) => handleStatusChange(request.id, value)}
                    >
                      <SelectTrigger className="w-[130px]">
                        <Badge className={statusColors[request.status]}>{request.status}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(request.created_at), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data.total_pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Showing {(page - 1) * data.page_size + 1} to{' '}
              {Math.min(page * data.page_size, data.total)} of {data.total} requests
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === data.total_pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedSubmissionId && (
        <SubmissionDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          submissionId={selectedSubmissionId}
          submissionType="demo"
          onStatusUpdate={fetchDemoRequests}
        />
      )}
    </>
  );
}
