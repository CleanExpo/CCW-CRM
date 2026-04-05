'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSearchState } from '@/hooks/use-search-state';
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
import {
  Package,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  ScanBarcode,
  Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import type { InventoryItem, StockByLocation, StoreLocation } from '@/types/inventory';
import { inventoryApi } from '@/lib/api/inventory';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { StockTransferDialog } from '../components/StockTransferDialog';
import { StockAdjustmentDialog } from '../components/StockAdjustmentDialog';
import { format } from 'date-fns';

export default function InventoryStockPage() {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Dialogs
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  // Search state persistence
  const { state: searchState, updateField } = useSearchState({
    key: 'inventory-stock-list',
    defaultState: { page: 1, pageSize: 50, search: '', location: 'all', stockStatus: 'all' },
  });

  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const searchQuery = searchState.search || '';
  const locationFilter = searchState.location || 'all';
  const stockStatusFilter = searchState.stockStatus || 'all';

  const setPage = (value: number) => updateField('page', value);
  const setPageSize = (value: number) => updateField('pageSize', value);
  const setSearchQuery = (value: string) => {
    updateField('search', value);
    updateField('page', 1); // Reset to first page on search
  };
  const setLocationFilter = (value: string) => {
    updateField('location', value);
    updateField('page', 1);
  };
  const setStockStatusFilter = (value: string) => {
    updateField('stockStatus', value);
    updateField('page', 1);
  };

  // Load inventory data
  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await inventoryApi.list({
        page,
        page_size: pageSize,
        search: searchQuery || undefined,
        location: locationFilter === 'all' ? undefined : locationFilter,
        low_stock: stockStatusFilter === 'low' ? true : undefined,
      });

      setInventory(response.items);
      setTotal(response.total);
      setTotalPages(response.total_pages);
      setLastUpdated(new Date());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load inventory';
      console.error('Failed to load inventory:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      setInventory([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, locationFilter, stockStatusFilter, toast]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Calculate summary stats
  const getSummaryStats = () => {
    const totalProducts = total;
    const lowStockCount = inventory.filter((item) => {
      return item.stock_by_location.some((loc) => {
        return loc.reorder_point && loc.available <= loc.reorder_point;
      });
    }).length;

    const outOfStockCount = inventory.filter((item) => {
      return item.stock_by_location.some((loc) => loc.available === 0);
    }).length;

    const totalStockValue = inventory.reduce((sum, item) => {
      return sum + item.price * item.total_stock;
    }, 0);

    return { totalProducts, lowStockCount, outOfStockCount, totalStockValue };
  };

  const stats = getSummaryStats();

  // Get stock color based on availability and reorder point
  const getStockColor = (available: number, reorder?: number) => {
    if (available === 0) return 'text-destructive font-semibold';
    if (reorder && available <= reorder) return 'text-orange-600 font-semibold';
    if (available <= 20) return 'text-yellow-600 font-semibold';
    return 'text-green-600 font-semibold';
  };

  // Render stock cell for a specific location
  const renderStockCell = (item: InventoryItem, location: StoreLocation) => {
    const stock = item.stock_by_location.find((s) => s.location === location);
    if (!stock) {
      return <span className="text-muted-foreground text-sm">—</span>;
    }

    return (
      <div className="text-sm">
        <div className={getStockColor(stock.available, stock.reorder_point)}>
          {stock.available} avail
        </div>
        {stock.reserved > 0 && (
          <div className="text-muted-foreground text-xs">{stock.reserved} reserved</div>
        )}
      </div>
    );
  };

  // Barcode scanner — on scan, set search to SKU
  const handleBarcodeScan = useCallback(
    async (code: string) => {
      try {
        const product = await inventoryApi.lookupByBarcode(code);
        setSearchQuery(product.sku);
        toast({
          title: 'Barcode scanned',
          description: `${product.product_name} (${product.sku})`,
        });
      } catch {
        toast({
          variant: 'destructive',
          title: 'Barcode not found',
          description: `No product matched barcode: ${code}`,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast]
  );
  useBarcodeScanner({ onScan: handleBarcodeScan });

  // Action handlers
  const handleTransfer = (item: InventoryItem) => {
    setSelectedProduct(item);
    setTransferDialogOpen(true);
  };

  const handleAdjust = (item: InventoryItem) => {
    setSelectedProduct(item);
    setAdjustDialogOpen(true);
  };

  const handleActionSuccess = () => {
    loadInventory();
  };

  // Table columns
  const columns = [
    {
      key: 'sku',
      label: 'SKU',
      render: (item: InventoryItem) => (
        <span className="font-mono text-sm font-semibold">{item.sku}</span>
      ),
    },
    {
      key: 'name',
      label: 'Product Name',
      render: (item: InventoryItem) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'brisbane',
      label: 'Brisbane',
      render: (item: InventoryItem) => renderStockCell(item, 'brisbane' as StoreLocation),
    },
    {
      key: 'sydney',
      label: 'Sydney',
      render: (item: InventoryItem) => renderStockCell(item, 'sydney' as StoreLocation),
    },
    {
      key: 'melbourne',
      label: 'Melbourne',
      render: (item: InventoryItem) => renderStockCell(item, 'melbourne' as StoreLocation),
    },
    {
      key: 'total_available',
      label: 'Total Available',
      align: 'right' as const,
      render: (item: InventoryItem) => (
        <span className={getStockColor(item.total_available)}>{item.total_available}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right' as const,
      render: (item: InventoryItem) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => handleTransfer(item)}>
            Transfer
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleAdjust(item)}>
            Adjust
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Inventory</h1>
          <p className="text-muted-foreground">Manage stock levels across all locations</p>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <ScanBarcode className="h-4 w-4" />
          <span>Scanner ready</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-muted-foreground text-xs">Across all locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStockCount}</div>
            <p className="text-muted-foreground text-xs">Below reorder point</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="text-destructive h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">{stats.outOfStockCount}</div>
            <p className="text-muted-foreground text-xs">Out of stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalStockValue.toFixed(2)}</div>
            <p className="text-muted-foreground text-xs">Current inventory value</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search and filter inventory by location and stock status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                <Input
                  placeholder="Search by SKU or product name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

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

            {/* Stock status filter */}
            <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stock Inventory</CardTitle>
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
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : inventory.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="text-muted-foreground mx-auto h-12 w-12" />
              <h3 className="mt-4 text-lg font-semibold">No inventory found</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {searchQuery || locationFilter !== 'all' || stockStatusFilter !== 'all'
                  ? 'Try adjusting your filters to see more results'
                  : 'No products have been added to inventory yet'}
              </p>
            </div>
          ) : (
            <>
              <ResponsiveTable
                data={inventory}
                columns={columns}
                keyExtractor={(item) => item.id}
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
      {selectedProduct && (
        <>
          <StockTransferDialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            productSku={selectedProduct.sku}
            onSuccess={handleActionSuccess}
          />
          <StockAdjustmentDialog
            open={adjustDialogOpen}
            onOpenChange={setAdjustDialogOpen}
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            productSku={selectedProduct.sku}
            onSuccess={handleActionSuccess}
          />
        </>
      )}
    </div>
  );
}
