"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Package } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Product } from "../types";

interface ProductSearchProps {
  onAddProduct: (product: Product) => void;
}

interface PaginatedResponse {
  items: Product[];
  total: number;
}

export function ProductSearch({ onAddProduct }: ProductSearchProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Search products
  const searchProducts = useCallback(async () => {
    if (!debouncedSearch.trim()) {
      setProducts([]);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse>(
        `/api/products?search=${encodeURIComponent(debouncedSearch)}&page_size=10`
      );
      setProducts(response.items.filter((p) => p.is_active && p.stock > 0));
    } catch (error) {
      console.error("Failed to search products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    searchProducts();
  }, [searchProducts]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by SKU or product name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-lg"
          autoFocus
        />
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </>
        ) : products.length > 0 ? (
          products.map((product) => (
            <Card
              key={product.id}
              className="p-4 hover:bg-accent cursor-pointer transition-colors"
              onClick={() => onAddProduct(product)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {product.sku}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold text-lg">
                      {formatCurrency(product.price)}
                    </div>
                    <Badge variant={product.stock > 10 ? "default" : "destructive"}>
                      {product.stock} in stock
                    </Badge>
                  </div>
                  <Button size="icon" variant="ghost">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : debouncedSearch ? (
          <div className="text-center py-8 text-muted-foreground">
            No products found for "{debouncedSearch}"
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Start typing to search for products
          </div>
        )}
      </div>
    </div>
  );
}
