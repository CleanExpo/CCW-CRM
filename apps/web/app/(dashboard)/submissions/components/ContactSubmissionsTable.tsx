'use client';

import { useEffect, useState } from 'react';
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
import { Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { SubmissionDetailDialog } from './SubmissionDetailDialog';
import { toast } from 'sonner';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source: string;
  status: 'new' | 'read' | 'responded' | 'closed';
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  items: ContactSubmission[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  read: 'bg-yellow-100 text-yellow-800',
  responded: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

interface ContactSubmissionsTableProps {
  searchQuery?: string;
  statusFilter?: string;
  onDataChange?: () => void;
}

export function ContactSubmissionsTable({
  searchQuery,
  statusFilter,
  onDataChange,
}: ContactSubmissionsTableProps) {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery, statusFilter]);

  async function fetchSubmissions() {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/contact-submissions?page=${page}&page_size=10`;
      if (statusFilter) {
        url += `&status_filter=${statusFilter}`;
      }
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const response = await apiClient.get<PaginatedResponse>(url);
      setData(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(submissionId: string, newStatus: string) {
    try {
      await apiClient.patch(`/api/contact-submissions/${submissionId}/status`, {
        status: newStatus,
      });
      toast.success('Status updated');
      fetchSubmissions();
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
    return <div className="text-muted-foreground py-8 text-center">Loading submissions...</div>;
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchSubmissions} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <Mail className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p className="text-lg font-medium">No contact submissions yet</p>
        <p className="text-sm">Submissions from the Contact Us form will appear here</p>
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
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((submission) => (
                <TableRow
                  key={submission.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleRowClick(submission.id)}
                >
                  <TableCell className="font-medium">{submission.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="text-muted-foreground h-4 w-4" />
                      {submission.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{submission.source}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={submission.status}
                      onValueChange={(value) => handleStatusChange(submission.id, value)}
                    >
                      <SelectTrigger className="w-[130px]">
                        <Badge className={statusColors[submission.status]}>
                          {submission.status}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="responded">Responded</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(submission.created_at), 'MMM d, yyyy')}
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
              {Math.min(page * data.page_size, data.total)} of {data.total} submissions
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
          submissionType="contact"
          onStatusUpdate={fetchSubmissions}
        />
      )}
    </>
  );
}
