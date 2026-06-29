'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
// PHASE 4: Real-time inventory updates
import { RealTimeIndicator } from '@/components/ui/real-time-indicator';
import { useInventoryStream } from '@/hooks/use-sse';
// PHASE 4: Search state persistence
import { MultiLocationStockCell } from '@/components/inventory/MultiLocationStockCell';
import { ResponsiveTable } from '@/components/responsive-table/ResponsiveTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { useSearchState } from '@/hooks/use-search-state';
import { exportProductsToCSV } from '@/lib/utils/csv-export';
import { ArrowLeftRight, Download, Eye, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { StockTransferDialog } from '../inventory/components/StockTransferDialog';
import { BulkDeleteProductsDialog } from './components/BulkDeleteProductsDialog';
import { DeleteProductDialog } from './components/DeleteProductDialog';
import { ProductForm } from './components/ProductForm';
// PHASE 4: Last updated timestamps
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { formatDistanceToNow } from 'date-fns';
import {
  OperationsPageHeader,
  OperationsPageLayout,
} from '@/components/operations/OperationsPageHeader';
import { opCardClass, opHeroSurfaceClass } from '@/lib/operations/ui';
import { cn } from '@/lib/utils';

interface StockByLocation {
  location: string;
  stock: number;
  reserved: number;
  available: number;
}

type ProductCategory =
  | 'heavy_machinery'
  | 'hand_tools'
  | 'power_tools'
  | 'safety_equipment'
  | 'building_materials'
  | 'electrical'
  | 'plumbing'
  | 'accessories';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: number;
  cost: number;
  stock: number;
  warehouse_location: string | null;
  is_active: boolean;
  stock_by_location?: StockByLocation[];
}

interface PaginatedResponse {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // PHASE 4: Last updated timestamp
  const [formOpen, setFormOpen] = useState(false);

  // PHASE 4: Search state persistence - remembers search/pagination on navigation
  const { state: searchState, updateField } = useSearchState({
    key: 'products-list',
    defaultState: { search: '', page: 1, pageSize: 50 },
  });

  const search = searchState.search || '';
  const page = searchState.page || 1;
  const pageSize = searchState.pageSize || 50;
  const setSearch = useCallback((value: string) => updateField('search', value), [updateField]);
  const setPage = useCallback((value: number) => updateField('page', value), [updateField]);
  const setPageSize = useCallback((value: number) => updateField('pageSize', value), [updateField]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // PHASE 4: Real-time inventory updates via SSE
  const { data: inventoryUpdate, status: sseStatus, stats: sseStats } = useInventoryStream();

  // Update product stock in real-time when SSE event received
  useEffect(() => {
    if (inventoryUpdate) {
      setProducts((prevProducts) =>
        prevProducts.map((product) => {
          // Find matching product and location
          if (product.id === inventoryUpdate.product_id) {
            return {
              ...product,
              stock_by_location: product.stock_by_location?.map((loc) =>
                loc.location === inventoryUpdate.location
                  ? {
                      ...loc,
                      stock: inventoryUpdate.stock,
                      reserved: inventoryUpdate.reserved,
                      available: inventoryUpdate.available,
                    }
                  : loc
              ),
            };
          }
          return product;
        })
      );
    }
  }, [inventoryUpdate]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      // PHASE 4 OPTIMIZATION: include_stock=true fetches stock_by_location in single query
      // Before: 50 products = 51 API calls (1 list + 50 stock lookups)
      // After: 50 products = 1 API call (98% reduction)
      const data = await apiClient.get<PaginatedResponse>(
        `/api/products?page=${page}&page_size=${pageSize}&include_inactive=true&include_stock=true${
          debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''
        }`,
        undefined,
        45_000
      );

      // Stock data is now included in the response - no additional API calls needed!
      setProducts(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.includes('timeout')
          ? 'Products are taking longer than usual to load. Please wait a moment and try again.'
          : error instanceof Error
            ? error.message
            : 'Failed to load products';
      toast({
        variant: 'destructive',
        title: 'Could not load products',
        description: message,
      });
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setLastUpdated(new Date()); // PHASE 4: Track last update time
    }
  }, [page, pageSize, debouncedSearch, toast]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounce);
  }, [search, setPage]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    setSelectedProduct(null);
    setFormOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete('create');
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormOpen(true);
  };

  const handleDeleteProduct = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleTransferStock = (product: Product) => {
    setSelectedProduct(product);
    setTransferDialogOpen(true);
  };

  const handleExport = () => {
    exportProductsToCSV(products as unknown as Record<string, unknown>[]);
    toast({
      title: 'Export Successful',
      description: `Exported ${products.length} products to CSV`,
    });
  };

  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map((p) => p.id));
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleteDialogOpen(true);
  };

  const handleSuccess = () => {
    loadProducts();
    setSelectedProductIds([]);
  };

  return (
    <ErrorBoundary>
      <OperationsPageLayout className="space-y-6">
        <OperationsPageHeader
          sectionLabel="Inventory"
          accent="forest"
          title="Products"
          description={
            selectedProductIds.length > 0
              ? `${selectedProductIds.length} selected item(s).`
              : 'Manage your cleaning equipment catalog, stock availability, and pricing.'
          }
          icon={Package}
          actions={
            <div className="flex gap-2">
              {selectedProductIds.length > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedProductIds.length})
                </Button>
              )}
              <Button variant="outline" onClick={handleExport} disabled={products.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={handleAddProduct}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
          }
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* PHASE 4: Real-time connection indicator */}
            <RealTimeIndicator status={sseStatus} messagesReceived={sseStats.messagesReceived} />
          </div>
        </div>

        <Card className={cn(opCardClass, opHeroSurfaceClass)}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cleaning Equipment Catalog</CardTitle>
                <CardDescription>
                  {total} equipment SKUs in stock
                  {lastUpdated && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      • Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="mt-4">
              <Input
                placeholder="Search by equipment name, model, or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground text-lg font-medium">No equipment found</p>
                <p className="text-muted-foreground mt-2 text-sm">
                  {search
                    ? 'Try adjusting your search criteria.'
                    : 'Add your first cleaning equipment item to get started.'}
                </p>
                {!search && (
                  <Button onClick={handleAddProduct} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                )}
              </div>
            ) : (
              <ResponsiveTable
                data={products}
                keyExtractor={(product) => product.id}
                columns={[
                  {
                    key: 'select',
                    label: (
                      <Checkbox
                        checked={
                          products.length > 0 && selectedProductIds.length === products.length
                        }
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Select all products"
                      />
                    ),
                    className: 'w-12',
                    render: (product) => (
                      <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={() => handleToggleSelectProduct(product.id)}
                        aria-label={`Select ${product.name}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ),
                  },
                  {
                    key: 'sku',
                    label: 'SKU',
                    className: 'font-mono text-sm',
                    render: (product) => product.sku,
                  },
                  {
                    key: 'name',
                    label: 'Name',
                    className: 'font-medium',
                    render: (product) => product.name,
                  },
                  {
                    key: 'category',
                    label: 'Category',
                    render: (product) => (
                      <Badge variant="outline" className="capitalize">
                        {product.category ? product.category.replace(/_/g, ' ') : 'N/A'}
                      </Badge>
                    ),
                  },
                  {
                    key: 'price',
                    label: 'Price',
                    render: (product) => formatCurrency(product.price),
                  },
                  {
                    key: 'stock',
                    label: 'Stock by Location',
                    render: (product) =>
                      product.stock_by_location && product.stock_by_location.length > 0 ? (
                        <MultiLocationStockCell
                          productId={product.id}
                          locations={product.stock_by_location}
                        />
                      ) : (
                        <span
                          className={product.stock <= 10 ? 'text-destructive font-semibold' : ''}
                        >
                          {product.stock}
                        </span>
                      ),
                  },
                  {
                    key: 'warehouse',
                    label: 'Warehouse',
                    hideOnMobile: true,
                    render: (product) => product.warehouse_location || 'N/A',
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (product) => (
                      <Badge variant={product.is_active ? 'default' : 'secondary'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    ),
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    className: 'text-right',
                    mobileLabel: '',
                    render: (product) => (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Product"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/dashboard/inventory/products/${product.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTransferStock(product);
                          }}
                          title="Transfer Stock"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProduct(product);
                          }}
                          title="Edit Product"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(product);
                          }}
                          title="Delete Product"
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            )}

            {!loading && products.length > 0 && (
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={total}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1); // Reset to first page when changing page size
                }}
              />
            )}
          </CardContent>
        </Card>

        <ProductForm
          product={selectedProduct}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={handleSuccess}
        />

        <DeleteProductDialog
          product={selectedProduct}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onSuccess={handleSuccess}
        />

        <BulkDeleteProductsDialog
          productIds={selectedProductIds}
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          onSuccess={handleSuccess}
        />

        {selectedProduct && (
          <StockTransferDialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            productSku={selectedProduct.sku}
            onSuccess={handleSuccess}
          />
        )}
      </OperationsPageLayout>
    </ErrorBoundary>
  );
}
