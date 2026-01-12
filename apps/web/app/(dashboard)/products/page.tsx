"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductForm } from "./components/ProductForm";
import { DeleteProductDialog } from "./components/DeleteProductDialog";
import { MultiLocationStockCell } from "@/components/inventory/MultiLocationStockCell";
import { Pencil, Trash2, Plus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable } from "@/components/responsive-table/ResponsiveTable";

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

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  async function loadProducts() {
    setLoading(true);
    try {
      const data = await apiClient.get<PaginatedResponse>(
        `/api/products?page=1&page_size=50${search ? `&search=${search}` : ""}`
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
            console.error(`Failed to load stock for product ${product.id}:`, err);
            return {
              ...product,
              stock_by_location: [],
            };
          }
        })
      );

      setProducts(productsWithStock);
      setTotal(data.total);
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
    const debounce = setTimeout(loadProducts, 300);
    return () => clearTimeout(debounce);
  }, [search]);

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

  const handleSuccess = () => {
    loadProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={handleAddProduct}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <Card>
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
            <Input
              placeholder="Search products by name or SKU..."
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
              <p className="text-lg font-medium text-muted-foreground">
                No products found
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {search
                  ? "Try adjusting your search criteria."
                  : "Add your first product to get started."}
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
                    <Badge variant="outline" className="capitalize">
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
                      <span className={product.stock <= 10 ? "text-destructive font-semibold" : ""}>
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
                    <Badge variant={product.is_active ? "default" : "secondary"}>
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
                          handleEditProduct(product);
                        }}
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
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ),
                },
              ]}
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
    </div>
  );
}
