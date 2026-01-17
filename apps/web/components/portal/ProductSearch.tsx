"use client";

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";
import { debounce } from "lodash";

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  warehouse_location: string;
}

interface ProductSearchProps {
  onProductSelect: (product: Product) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function ProductSearch({
  onProductSelect,
  placeholder = "Search by SKU, name, or scan barcode...",
  autoFocus = false,
}: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search function
  const searchProducts = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (!searchQuery || searchQuery.length < 2) {
          setResults([]);
          setIsSearching(false);
          return;
        }

        setIsSearching(true);
        try {
          const response = await apiClient.get<{ items: Product[] }>(
            `/api/products?search=${encodeURIComponent(searchQuery)}&page_size=10`
          );
          setResults(response.items || []);
          setShowResults(true);
        } catch (error) {
          console.error("Product search failed:", error);
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300),
    []
  );

  useEffect(() => {
    return () => searchProducts.cancel();
  }, [searchProducts]);

  useEffect(() => {
    searchProducts(query);
  }, [query, searchProducts]);

  const handleSelect = (product: Product) => {
    onProductSelect(product);
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  const getStockBadge = (stock: number) => {
    if (stock > 10) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          In Stock
        </Badge>
      );
    } else if (stock > 0) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          Low Stock
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          Out of Stock
        </Badge>
      );
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          onBlur={() => {
            // Delay to allow click on results
            setTimeout(() => setShowResults(false), 200);
          }}
          autoFocus={autoFocus}
          className="pl-10 text-base"
        />
      </div>

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <Card className="absolute z-50 mt-2 w-full max-h-96 overflow-y-auto shadow-lg">
          <div className="divide-y">
            {results.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelect(product)}
                className="w-full p-4 text-left hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{product.sku}</span>
                      {getStockBadge(product.stock)}
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {product.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{product.category}</span>
                      <span>|</span>
                      <span>{product.stock} in stock</span>
                      {product.warehouse_location && (
                        <>
                          <span>|</span>
                          <span>{product.warehouse_location}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">
                      ${product.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* No Results */}
      {showResults && !isSearching && query.length >= 2 && results.length === 0 && (
        <Card className="absolute z-50 mt-2 w-full p-4 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">
            No products found for &quot;{query}&quot;
          </p>
        </Card>
      )}

      {/* Searching Indicator */}
      {isSearching && (
        <Card className="absolute z-50 mt-2 w-full p-4 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">Searching...</p>
        </Card>
      )}
    </div>
  );
}
