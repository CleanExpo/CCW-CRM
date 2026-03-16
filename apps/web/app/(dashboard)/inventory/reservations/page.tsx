"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchState } from "@/lib/hooks/use-search-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Clock, AlertTriangle, Box, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StockReservation } from "@/lib/types/inventory";
import { apiClient } from "@/lib/api/client";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { StockReservationDialog } from "@/components/inventory/StockReservationDialog";
import { ReleaseReservationDialog } from "@/components/inventory/ReleaseReservationDialog";
import { format, formatDistanceToNow, isPast, differenceInHours } from "date-fns";

interface PaginatedReservationsResponse {
  items: StockReservation[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function ReservationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<StockReservation | null>(null);

  // Search state persistence
  const { state: searchState, updateField } = useSearchState({
    key: "inventory-reservations-list",
    defaultState: {
      page: 1,
      pageSize: 50,
      search: "",
      status: "all",
      location: "all",
    },
  });

  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const searchQuery = searchState.search || "";
  const statusFilter = searchState.status || "all";
  const locationFilter = searchState.location || "all";

  const setPage = (value: number) => updateField("page", value);
  const setPageSize = (value: number) => updateField("pageSize", value);
  const setSearchQuery = (value: string) => {
    updateField("search", value);
    updateField("page", 1);
  };
  const setStatusFilter = (value: string) => {
    updateField("status", value);
    updateField("page", 1);
  };
  const setLocationFilter = (value: string) => {
    updateField("location", value);
    updateField("page", 1);
  };

  // Load reservations
  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("page_size", pageSize.toString());
      if (statusFilter !== "all") queryParams.append("status", statusFilter);
      if (locationFilter !== "all") queryParams.append("location", locationFilter);

      const response = await apiClient.get<PaginatedReservationsResponse>(
        `/api/inventory/reservations?${queryParams.toString()}`
      );

      // Filter by search on frontend
      let filteredItems = response.items;
      if (searchQuery) {
        filteredItems = filteredItems.filter((reservation) => {
          const searchLower = searchQuery.toLowerCase();
          return (
            reservation.product_name?.toLowerCase().includes(searchLower) ||
            reservation.product_sku?.toLowerCase().includes(searchLower) ||
            reservation.order_number?.toLowerCase().includes(searchLower)
          );
        });
      }

      setReservations(filteredItems);
      setTotal(response.total);
      setTotalPages(response.total_pages);
      setLastUpdated(new Date());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load reservations";
      console.error("Failed to load reservations:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
      setReservations([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter, locationFilter, toast]);

  useEffect(() => {
    loadReservations();

    // Auto-refresh every 30s for expiration updates
    const interval = setInterval(loadReservations, 30000);
    return () => clearInterval(interval);
  }, [loadReservations]);

  // Calculate summary stats
  const getSummaryStats = () => {
    const activeCount = reservations.filter((r) => r.status === "active").length;

    // Expiring soon (<6 hours)
    const expiringSoonCount = reservations.filter((r) => {
      if (r.status !== "active" || !r.expires_at) return false;
      const hoursUntilExpiry = differenceInHours(new Date(r.expires_at), new Date());
      return hoursUntilExpiry >= 0 && hoursUntilExpiry < 6;
    }).length;

    // Expired today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiredTodayCount = reservations.filter((r) => {
      if (r.status !== "expired" || !r.expires_at) return false;
      const expiredDate = new Date(r.expires_at);
      expiredDate.setHours(0, 0, 0, 0);
      return expiredDate.getTime() === today.getTime();
    }).length;

    const totalReserved = reservations.reduce((sum, r) => {
      return r.status === "active" ? sum + r.quantity : sum;
    }, 0);

    return { activeCount, expiringSoonCount, expiredTodayCount, totalReserved };
  };

  const stats = getSummaryStats();

  // Get expiration status
  const getExpirationStatus = (reservation: StockReservation) => {
    if (!reservation.expires_at) return null;
    const expiresAt = new Date(reservation.expires_at);
    const now = new Date();
    const hoursUntil = differenceInHours(expiresAt, now);

    if (hoursUntil < 0) {
      return { type: "expired" as const, color: "text-destructive", text: "Expired" };
    } else if (hoursUntil < 6) {
      return {
        type: "expiring" as const,
        color: "text-orange-600",
        text: `Expires ${formatDistanceToNow(expiresAt, { addSuffix: true })}`,
      };
    } else {
      return {
        type: "active" as const,
        color: "text-green-600",
        text: `Expires ${formatDistanceToNow(expiresAt, { addSuffix: true })}`,
      };
    }
  };

  // Handle release
  const handleRelease = (reservation: StockReservation) => {
    setSelectedReservation(reservation);
    setReleaseDialogOpen(true);
  };

  // Handle view order
  const handleViewOrder = (reservation: StockReservation) => {
    // TODO: Navigate to order detail page once it exists
    toast({
      title: "View Order",
      description: `Order ID: ${reservation.order_number || reservation.order_id}`,
    });
  };

  const formatLocation = (location: string) => {
    return location.charAt(0).toUpperCase() + location.slice(1);
  };

  // Table columns
  const columns = [
    {
      key: "order",
      label: "Order #",
      render: (reservation: StockReservation) => (
        <span className="font-mono text-sm font-semibold">
          {reservation.order_number || reservation.order_id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "product",
      label: "Product",
      render: (reservation: StockReservation) => (
        <div>
          <div className="font-medium">{reservation.product_name || "—"}</div>
          <div className="text-sm text-muted-foreground font-mono">{reservation.product_sku || "—"}</div>
        </div>
      ),
    },
    {
      key: "location",
      label: "Location",
      render: (reservation: StockReservation) => (
        <span className="font-medium">{formatLocation(reservation.location)}</span>
      ),
    },
    {
      key: "quantity",
      label: "Quantity",
      align: "center" as const,
      render: (reservation: StockReservation) => (
        <span className="font-semibold">{reservation.quantity}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (reservation: StockReservation) => {
        const statusConfig = {
          active: { variant: "default" as const, label: "Active" },
          fulfilled: { variant: "default" as const, label: "Fulfilled" },
          cancelled: { variant: "secondary" as const, label: "Cancelled" },
          expired: { variant: "destructive" as const, label: "Expired" },
        };
        const config = statusConfig[reservation.status] || statusConfig.active;
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      key: "expires",
      label: "Expires",
      render: (reservation: StockReservation) => {
        const status = getExpirationStatus(reservation);
        if (!status) return <span className="text-muted-foreground">—</span>;
        return <div className={`text-sm ${status.color}`}>{status.text}</div>;
      },
    },
    {
      key: "reserved_by",
      label: "Reserved By",
      render: (reservation: StockReservation) => (
        <div className="text-sm">
          <div>{reservation.reserved_by}</div>
          <div className="text-muted-foreground">
            {format(new Date(reservation.reserved_at), "MMM d")}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right" as const,
      render: (reservation: StockReservation) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewOrder(reservation)}
          >
            View Order
          </Button>
          {reservation.status === "active" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRelease(reservation)}
            >
              Release
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Reservations</h1>
          <p className="text-muted-foreground">
            View and manage order-linked stock holds
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Package className="h-4 w-4 mr-2" />
          New Reservation
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Reservations</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
            <p className="text-xs text-muted-foreground">Currently reserved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.expiringSoonCount}</div>
            <p className="text-xs text-muted-foreground">Within 6 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired Today</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.expiredTodayCount}</div>
            <p className="text-xs text-muted-foreground">Auto-released</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reserved</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReserved}</div>
            <p className="text-xs text-muted-foreground">Units on hold</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter reservations by status and location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product, order, or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            {/* Location filter */}
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="brisbane">Brisbane</SelectItem>
                <SelectItem value="sydney">Sydney</SelectItem>
                <SelectItem value="melbourne">Melbourne</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reservations Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Reservation List</CardTitle>
              {lastUpdated && (
                <CardDescription>
                  Last updated: {format(lastUpdated, "h:mm:ss a")} • Auto-refreshing
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No reservations found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all" || locationFilter !== "all"
                  ? "Try adjusting your filters to see more results"
                  : "No stock reservations have been created yet"}
              </p>
            </div>
          ) : (
            <>
              <ResponsiveTable
                data={reservations}
                columns={columns}
                keyExtractor={(reservation) => reservation.id}
              />
              <div className="mt-4">
                <PaginationControls
                  currentPage={page}
                  pageSize={pageSize}
                  totalItems={total}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <StockReservationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadReservations}
      />

      <ReleaseReservationDialog
        reservation={selectedReservation}
        open={releaseDialogOpen}
        onOpenChange={setReleaseDialogOpen}
        onSuccess={loadReservations}
      />
    </div>
  );
}
