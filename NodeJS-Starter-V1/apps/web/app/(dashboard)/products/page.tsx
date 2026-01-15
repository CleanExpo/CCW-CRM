"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductForm } from "./components/ProductForm";
import { DeleteProductDialog } from "./components/DeleteProductDialog";
import { BulkDeleteProductsDialog } from "./components/BulkDeleteProductsDialog";
import { BulkStatusToggleDialog } from "./components/BulkStatusToggleDialog";
import { MultiLocationStockCell } from "@/components/inventory/MultiLocationStockCell";
import { StockTransferDialog } from "@/app/(dashboard)/inventory/components/StockTransferDialog";
import { AdvancedSearchFilter, ActiveFilter, FilterField } from "@/components/advanced-search/AdvancedSearchFilter";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { BulkActionBar, BulkAction } from "@/components/bulk-operations/BulkActionBar";
import { BulkExportDialog } from "@/components/bulk-operations/BulkExportDialog";
import { Pencil, Trash2, Plus, ArrowLeftRight, Download, Package, ToggleLeft } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { exportProductsToCSV } from "@/lib/utils/csv-export";

interface StockByLocation {
  location: string;
  stock: number;
  reserved: number;
  available: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
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

// Filter field configuration for products
const productFilterFields: FilterField[] = [
  { key: "category", label: "Category", type: "text", placeholder: "e.g., Electronics" },
  { key: "is_active", label: "Status", type: "select", options: [
    { label: "Active", value: "true" },
    { label: "Inactive", value: "false" },
  ]},
  { key: "min_price", label: "Min Price", type: "number", placeholder: "0.00" },
  { key: "max_price", label: "Max Price", type: "number", placeholder: "1000.00" },
  { key: "min_stock", label: "Min Stock", type: "number", placeholder: "0" },
  { key: "max_stock", label: "Max Stock", type: "number", placeholder: "1000" },
];

// Quick filters for common scenarios
const quickFilters = [
  { label: "Low Stock (<10)", filters: [{ field: "max_stock", operator: "lt", value: 10, label: "Stock < 10" }] },
  { label: "Active Products", filters: [{ field: "is_active", operator: "equals", value: "true", label: "Status: Active" }] },
  { label: "Inactive Products", filters: [{ field: "is_active", operator: "equals", value: "false", label: "Status: Inactive" }] },
];

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Load filter presets
  const { presets, savePreset, deletePreset } = useFilterPresets("products");

  async function loadProducts() {
    setLoading(true);
    try {
      // Build query string from filters
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("page_size", pageSize.toString());

      if (search) {
        params.append("search", search);
      }

      // Add active filters to query
      activeFilters.forEach((filter) => {
        if (filter.field === "is_active") {
          params.append(filter.field, filter.value);
        } else if (filter.field === "category") {
          params.append("category", filter.value);
        } else {
          params.append(filter.field, filter.value.toString());
        }
      });

      const data = await apiClient.get<PaginatedResponse>(
        `/api/products?${params.toString()}`
      );

      // Fetch multi-location stock data for each product
      const productsWithStock = await Promise.all(
        data.items.map(async (product) => {
          try {
            const stockResponse = await apiClient.get<{ locations: StockByLocation[] }>(
              `/api/inventory/product/${product.id}/locations`
            );
            const stockData = stockResponse.locations || [];
            return {
              ...product,
              stock_by_location: Array.isArray(stockData) ? stockData : [],
            };
          } catch (err) {
            // Stock data unavailable for this product, return empty array
            return {
              ...product,
              stock_by_location: [],
            };
          }
        })
      );

      setProducts(productsWithStock);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error: any) {
      console.error("Failed to load products:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load products",
      });
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Reset to page 1 when search or filters change
    if (page !== 1) {
      setPage(1);
    } else {
      loadProducts();
    }
  }, [search, activeFilters]);

  useEffect(() => {
    loadProducts();
  }, [page, pageSize]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
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
    exportProductsToCSV(products);
    toast({
      title: "Export Successful",
      description: `Exported ${products.length} products to CSV`,
    });
  };

  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
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

  const handleBulkStatusToggle = () => {
    setBulkStatusDialogOpen(true);
  };

  const handleBulkExport = () => {
    setBulkExportDialogOpen(true);
  };

  const handleBulkExportExecute = async (format: string, options: any) => {
    const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));

    if (format === "csv") {
      exportProductsToCSV(selectedProducts);
    } else if (format === "json") {
      const dataStr = JSON.stringify(selectedProducts, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `products-${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSuccess = () => {
    loadProducts();
    setSelectedProductIds([]);
  };

  // Define bulk actions for the action bar
  const bulkActions: BulkAction[] = [
    {
      id: "toggle-status",
      label: "Toggle Status",
      icon: ToggleLeft,
      variant: "default",
      onClick: handleBulkStatusToggle,
    },
    {
      id: "export",
      label: "Export",
      icon: Download,
      variant: "outline",
      onClick: handleBulkExport,
    },
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: handleBulkDelete,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Products
          </h1>
          <p className="text-muted-foreground">
            {selectedProductIds.length > 0
              ? `${selectedProductIds.length} selected`
              : "Manage your product catalog"}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedProductIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
            >
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
      </div>

      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Catalog</CardTitle>
              <CardDescription>
                {total} products in inventory
              </CardDescription>
            </div>
          </div>
          <div className="mt-4">
            <AdvancedSearchFilter
              fields={productFilterFields}
              onFiltersChange={setActiveFilters}
              onSearchChange={setSearch}
              presets={presets}
              onSavePreset={savePreset}
              onDeletePreset={deletePreset}
              quickFilters={quickFilters}
              searchPlaceholder="Search products by name or SKU..."
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-brand-primary-100 p-4 mb-4 dark:bg-brand-primary-950">
                <Package className="h-10 w-10 text-brand-primary-600 dark:text-brand-primary-400" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                No products found
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {search
                  ? "Try adjusting your search criteria to find what you're looking for."
                  : "Get started by adding your first product to the catalog."}
              </p>
              {!search && (
                <Button onClick={handleAddProduct} className="mt-6">
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
                  key: "select",
                  label: (
                    <Checkbox
                      checked={
                        products.length > 0 &&
                        selectedProductIds.length === products.length
                      }
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Select all products"
                    />
                  ),
                  className: "w-12",
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
                  key: "sku",
                  label: "SKU",
                  className: "font-mono text-sm",
                  render: (product) => product.sku,
                },
                {
                  key: "name",
                  label: "Name",
                  className: "font-medium",
                  render: (product) => product.name,
                },
                {
                  key: "category",
                  label: "Category",
                  render: (product) => (
                    <Badge variant="outline" className="capitalize border-brand-primary-200 text-brand-primary-700 dark:border-brand-primary-800 dark:text-brand-primary-400">
                      {product.category.replace(/_/g, " ")}
                    </Badge>
                  ),
                },
                {
                  key: "price",
                  label: "Price",
                  render: (product) => formatCurrency(product.price),
                },
                {
                  key: "stock",
                  label: "Stock by Location",
                  render: (product) => (
                    product.stock_by_location && product.stock_by_location.length > 0 ? (
                      <MultiLocationStockCell
                        productId={product.id}
                        locations={product.stock_by_location}
                      />
                    ) : (
                      <span className={`font-semibold ${
                        product.stock === 0 ? "text-error" :
                        product.stock <= 10 ? "text-warning" :
                        product.stock <= 20 ? "text-info" :
                        "text-success"
                      }`}>
                        {product.stock}
                      </span>
                    )
                  ),
                },
                {
                  key: "warehouse",
                  label: "Warehouse",
                  hideOnMobile: true,
                  render: (product) => product.warehouse_location || "N/A",
                },
                {
                  key: "status",
                  label: "Status",
                  render: (product) => (
                    <Badge
                      variant={product.is_active ? "default" : "secondary"}
                      className={product.is_active ? "bg-success text-success-foreground border-success/20" : ""}
                    >
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions",
                  className: "text-right",
                  mobileLabel: "",
                  render: (product) => (
                    <div className="flex justify-end gap-2">
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
                        <Trash2 className="h-4 w-4 text-destructive" />
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

      <BulkStatusToggleDialog
        open={bulkStatusDialogOpen}
        onOpenChange={setBulkStatusDialogOpen}
        selectedProductIds={selectedProductIds}
        onSuccess={handleSuccess}
      />

      <BulkExportDialog
        open={bulkExportDialogOpen}
        onOpenChange={setBulkExportDialogOpen}
        selectedCount={selectedProductIds.length}
        onExport={handleBulkExportExecute}
        entityName="products"
        availableFormats={[
          { value: "csv", label: "CSV", description: "Comma-separated values" },
          { value: "json", label: "JSON", description: "JavaScript Object Notation" },
        ]}
        availableFields={[
          { key: "sku", label: "SKU", defaultChecked: true },
          { key: "name", label: "Name", defaultChecked: true },
          { key: "category", label: "Category", defaultChecked: true },
          { key: "price", label: "Price", defaultChecked: true },
          { key: "cost", label: "Cost", defaultChecked: false },
          { key: "stock", label: "Total Stock", defaultChecked: true },
          { key: "is_active", label: "Active Status", defaultChecked: true },
        ]}
      />

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedProductIds.length}
        totalCount={total}
        actions={bulkActions}
        onClearSelection={() => setSelectedProductIds([])}
        onSelectAll={handleToggleSelectAll}
      />
    </div>
  );
}
