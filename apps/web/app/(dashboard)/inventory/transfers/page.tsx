'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSearchState } from '@/lib/hooks/use-search-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Clock, Truck, CheckCircle, Search, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { StockTransfer, TransferStatus } from '@/lib/types/inventory';
import { inventoryApi } from '@/lib/api/inventory';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { TransferStatusBadge } from '@/components/inventory/TransferStatusBadge';
import { format } from 'date-fns';

export default function TransfersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Search state persistence
  const { state: searchState, updateField } = useSearchState({
    key: 'inventory-transfers-list',
    defaultState: {
      page: 1,
      pageSize: 50,
      search: '',
      status: 'all',
      fromLocation: 'all',
      toLocation: 'all',
    },
  });

  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const searchQuery = searchState.search || '';
  const statusFilter = searchState.status || 'all';
  const fromLocationFilter = searchState.fromLocation || 'all';
  const toLocationFilter = searchState.toLocation || 'all';

  const setPage = (value: number) => updateField('page', value);
  const setPageSize = (value: number) => updateField('pageSize', value);
  const setSearchQuery = (value: string) => {
    updateField('search', value);
    updateField('page', 1);
  };
  const setStatusFilter = (value: string) => {
    updateField('status', value);
    updateField('page', 1);
  };
  const setFromLocationFilter = (value: string) => {
    updateField('fromLocation', value);
    updateField('page', 1);
  };
  const setToLocationFilter = (value: string) => {
    updateField('toLocation', value);
    updateField('page', 1);
  };

  // Load transfers
  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await inventoryApi.getTransfers({
        page,
        page_size: pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        from_location: fromLocationFilter === 'all' ? undefined : fromLocationFilter,
        to_location: toLocationFilter === 'all' ? undefined : toLocationFilter,
      });

      // Filter by search on frontend if search query exists
      let filteredItems = response.items;
      if (searchQuery) {
        filteredItems = filteredItems.filter((transfer) => {
          const searchLower = searchQuery.toLowerCase();
          return (
            transfer.product_name?.toLowerCase().includes(searchLower) ||
            transfer.product_sku?.toLowerCase().includes(searchLower)
          );
        });
      }

      setTransfers(filteredItems);
      setTotal(response.total);
      setTotalPages(response.total_pages);
      setLastUpdated(new Date());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load transfers';
      console.error('Failed to load transfers:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      setTransfers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter, fromLocationFilter, toLocationFilter, toast]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Calculate summary stats
  const getSummaryStats = () => {
    const totalTransfers = total;
    const pendingCount = transfers.filter((t) => t.status === 'pending').length;
    const inTransitCount = transfers.filter((t) => t.status === 'in_transit').length;

    // Completed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedTodayCount = transfers.filter((t) => {
      if (t.status !== 'completed' || !t.completed_at) return false;
      const completedDate = new Date(t.completed_at);
      completedDate.setHours(0, 0, 0, 0);
      return completedDate.getTime() === today.getTime();
    }).length;

    return { totalTransfers, pendingCount, inTransitCount, completedTodayCount };
  };

  const stats = getSummaryStats();

  // Navigate to detail page
  const handleViewTransfer = (transfer: StockTransfer) => {
    router.push(`/inventory/transfers/${transfer.id}`);
  };

  // Cancel transfer
  const handleCancelTransfer = async (transfer: StockTransfer) => {
    if (transfer.status !== 'pending') {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Only pending transfers can be cancelled',
      });
      return;
    }

    // TODO: Implement cancel endpoint
    toast({
      title: 'Not Implemented',
      description: 'Cancel transfer functionality coming soon',
    });
  };

  // Format location for display
  const formatLocation = (location: string) => {
    return location.charAt(0).toUpperCase() + location.slice(1);
  };

  // Table columns
  const columns = [
    {
      key: 'product',
      label: 'Product',
      render: (transfer: StockTransfer) => (
        <div>
          <div className="font-medium">{transfer.product_name || '—'}</div>
          <div className="text-muted-foreground font-mono text-sm">
            {transfer.product_sku || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'route',
      label: 'Transfer Route',
      render: (transfer: StockTransfer) => (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{formatLocation(transfer.from_location)}</span>
          <ArrowRight className="text-muted-foreground h-4 w-4" />
          <span className="font-medium">{formatLocation(transfer.to_location)}</span>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'center' as const,
      render: (transfer: StockTransfer) => (
        <span className="font-semibold">{transfer.quantity}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (transfer: StockTransfer) => <TransferStatusBadge status={transfer.status} />,
    },
    {
      key: 'initiated',
      label: 'Initiated',
      render: (transfer: StockTransfer) => (
        <div className="text-sm">
          <div>{format(new Date(transfer.initiated_at), 'MMM d, yyyy')}</div>
          <div className="text-muted-foreground">{transfer.initiated_by}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right' as const,
      render: (transfer: StockTransfer) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleViewTransfer(transfer)}>
            View Details
          </Button>
          {transfer.status === 'pending' && (
            <Button size="sm" variant="outline" onClick={() => handleCancelTransfer(transfer)}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Transfers</h1>
          <p className="text-muted-foreground">
            Track and manage stock transfers between locations
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transfers</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransfers}</div>
            <p className="text-muted-foreground text-xs">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</div>
            <p className="text-muted-foreground text-xs">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inTransitCount}</div>
            <p className="text-muted-foreground text-xs">Currently moving</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedTodayCount}</div>
            <p className="text-muted-foreground text-xs">Finished transfers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter transfers by status and location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                <Input
                  placeholder="Search by product name or SKU..."
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* From location filter */}
            <Select value={fromLocationFilter} onValueChange={setFromLocationFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="From Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="brisbane">Brisbane</SelectItem>
                <SelectItem value="sydney">Sydney</SelectItem>
                <SelectItem value="melbourne">Melbourne</SelectItem>
              </SelectContent>
            </Select>

            {/* To location filter */}
            <Select value={toLocationFilter} onValueChange={setToLocationFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="To Location" />
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

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transfer History</CardTitle>
              {lastUpdated && (
                <CardDescription>Last updated: {format(lastUpdated, 'h:mm:ss a')}</CardDescription>
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
          ) : transfers.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="text-muted-foreground mx-auto h-12 w-12" />
              <h3 className="mt-4 text-lg font-semibold">No transfers found</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {searchQuery ||
                statusFilter !== 'all' ||
                fromLocationFilter !== 'all' ||
                toLocationFilter !== 'all'
                  ? 'Try adjusting your filters to see more results'
                  : 'No stock transfers have been initiated yet'}
              </p>
            </div>
          ) : (
            <>
              <ResponsiveTable
                data={transfers}
                columns={columns}
                keyExtractor={(transfer) => transfer.id}
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
    </div>
  );
}
