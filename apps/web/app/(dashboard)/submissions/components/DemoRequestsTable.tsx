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
import { Building2, Mail, Phone, Calendar, Eye } from "lucide-react";
import { format } from "date-fns";

interface DemoRequest {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  product_interest: string | null;
  preferred_date: string | null;
  notes: string | null;
  status: "pending" | "scheduled" | "completed" | "cancelled";
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
  pending: "bg-yellow-500",
  scheduled: "bg-blue-500",
  completed: "bg-green-500",
  cancelled: "bg-gray-500",
};

export function DemoRequestsTable() {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchDemoRequests();
  }, [page]);

  async function fetchDemoRequests() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/demo-requests?page=${page}&page_size=10`
      );
      setData(response);
    } catch (err: any) {
      setError(err.message || "Failed to load demo requests");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return <div className="text-center py-8 text-muted-foreground">Loading demo requests...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchDemoRequests} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No demo requests yet</p>
        <p className="text-sm">Demo requests from potential customers will appear here</p>
      </div>
    );
  }

  return (
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {request.company_name}
                  </div>
                </TableCell>
                <TableCell>{request.contact_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {request.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[request.status]}>
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(request.created_at), "MMM d, yyyy")}
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
                        <DialogTitle>Demo Request Details</DialogTitle>
                        <DialogDescription>
                          Requested on {format(new Date(request.created_at), "MMMM d, yyyy 'at' h:mm a")}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Company Name</label>
                            <p className="text-sm text-muted-foreground">{request.company_name}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Contact Name</label>
                            <p className="text-sm text-muted-foreground">{request.contact_name}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Email</label>
                            <p className="text-sm text-muted-foreground">{request.email}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Phone</label>
                            <p className="text-sm text-muted-foreground">{request.phone}</p>
                          </div>
                        </div>
                        {request.product_interest && (
                          <div>
                            <label className="text-sm font-medium">Product Interest</label>
                            <p className="text-sm text-muted-foreground">{request.product_interest}</p>
                          </div>
                        )}
                        {request.preferred_date && (
                          <div>
                            <label className="text-sm font-medium">Preferred Demo Date</label>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(request.preferred_date), "MMMM d, yyyy")}
                            </p>
                          </div>
                        )}
                        {request.notes && (
                          <div>
                            <label className="text-sm font-medium">Notes</label>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {request.notes}
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-medium">Status</label>
                          <Badge className={statusColors[request.status]}>
                            {request.status}
                          </Badge>
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
  );
}
