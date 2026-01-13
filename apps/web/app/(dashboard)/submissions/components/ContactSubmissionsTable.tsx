"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, Phone, Calendar, Eye } from "lucide-react";
import { format } from "date-fns";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source: string;
  status: "new" | "read" | "responded" | "closed";
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
  new: "bg-blue-500",
  read: "bg-yellow-500",
  responded: "bg-green-500",
  closed: "bg-gray-500",
};

export function ContactSubmissionsTable() {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchSubmissions();
  }, [page]);

  async function fetchSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/contact-submissions?page=${page}&page_size=10`
      );
      setData(response);
    } catch (err: any) {
      setError(err.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return <div className="text-center py-8 text-muted-foreground">Loading submissions...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchSubmissions} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No contact submissions yet</p>
        <p className="text-sm">Submissions from the Contact Us form will appear here</p>
      </div>
    );
  }

  return (
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((submission) => (
              <TableRow key={submission.id}>
                <TableCell className="font-medium">{submission.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {submission.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{submission.source}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[submission.status]}>
                    {submission.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(submission.created_at), "MMM d, yyyy")}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Contact Submission Details</DialogTitle>
                        <DialogDescription>
                          Submitted on {format(new Date(submission.created_at), "MMMM d, yyyy 'at' h:mm a")}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Name</label>
                          <p className="text-sm text-muted-foreground">{submission.name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Email</label>
                            <p className="text-sm text-muted-foreground">{submission.email}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Phone</label>
                            <p className="text-sm text-muted-foreground">
                              {submission.phone || "Not provided"}
                            </p>
                          </div>
                        </div>
                        {submission.subject && (
                          <div>
                            <label className="text-sm font-medium">Subject</label>
                            <p className="text-sm text-muted-foreground">{submission.subject}</p>
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-medium">Message</label>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {submission.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <label className="text-sm font-medium">Source</label>
                            <p className="text-sm text-muted-foreground">{submission.source}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Status</label>
                            <Badge className={statusColors[submission.status]}>
                              {submission.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * data.page_size + 1} to{" "}
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
  );
}
