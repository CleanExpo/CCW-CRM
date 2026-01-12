"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";

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
  price: number;
  stock_by_location?: StockByLocation[];
}

interface LocationAwareProductSelectProps {
  selectedLocation?: string;
  onSelect: (product: Product) => void;
  value?: string;
}

export function LocationAwareProductSelect({
  selectedLocation = "brisbane",
  onSelect,
  value,
}: LocationAwareProductSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!search || search.length < 2) {
      setProducts([]);
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get<{ items: Product[] }>(
          `/api/products?search=${search}&page_size=20`
        );

        const productsWithStock = await Promise.all(
          response.items.map(async (product) => {
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

        productsWithStock.sort((a, b) => {
          const aStock = getStockAtLocation(a, selectedLocation);
          const bStock = getStockAtLocation(b, selectedLocation);
          return bStock - aStock;
        });

        setProducts(productsWithStock);
      } catch (error) {
        console.error("Failed to load products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchProducts, 300);
    return () => clearTimeout(debounce);
  }, [search, selectedLocation]);

  const getStockAtLocation = (product: Product, location: string): number => {
    if (!product.stock_by_location || !Array.isArray(product.stock_by_location)) return 0;
    return (
      product.stock_by_location.find(
        (s) => s.location.toLowerCase() === location.toLowerCase()
      )?.available || 0
    );
  };

  const getAlternativeLocations = (product: Product): string => {
    if (!product.stock_by_location || !Array.isArray(product.stock_by_location)) return "";
    return product.stock_by_location
      .filter(
        (s) =>
          s.location.toLowerCase() !== selectedLocation.toLowerCase() &&
          s.available > 0
      )
      .map((s) => `${s.location} (${s.available})`)
      .join(", ");
  };

  const inStock = products.filter(
    (p) => getStockAtLocation(p, selectedLocation) > 10
  );
  const lowStock = products.filter((p) => {
    const stock = getStockAtLocation(p, selectedLocation);
    return stock > 0 && stock <= 10;
  });
  const outOfStock = products.filter(
    (p) => getStockAtLocation(p, selectedLocation) === 0
  );

  const handleSelect = (product: Product) => {
    setSelectedProduct(product);
    onSelect(product);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start text-left font-normal"
        >
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {selectedProduct ? (
            <span>
              {selectedProduct.sku} - {selectedProduct.name}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Search products by SKU or name...
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search products..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading
                ? "Searching..."
                : search.length < 2
                ? "Type to search"
                : "No products found."}
            </CommandEmpty>

            {!loading && inStock.length > 0 && (
              <CommandGroup heading={`In Stock at ${selectedLocation}`}>
                {inStock.map((product) => (
                  <CommandItem
                    key={product.id}
                    onSelect={() => handleSelect(product)}
                    className="flex justify-between cursor-pointer"
                  >
                    <span className="flex-1">
                      <span className="font-mono text-sm">{product.sku}</span>
                      {" - "}
                      {product.name}
                    </span>
                    <Badge variant="secondary" className="ml-2">
                      {getStockAtLocation(product, selectedLocation)} available
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!loading && lowStock.length > 0 && (
              <CommandGroup heading="Low Stock">
                {lowStock.map((product) => (
                  <CommandItem
                    key={product.id}
                    onSelect={() => handleSelect(product)}
                    className="flex justify-between cursor-pointer"
                  >
                    <span className="flex-1">
                      <span className="font-mono text-sm">{product.sku}</span>
                      {" - "}
                      {product.name}
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {getStockAtLocation(product, selectedLocation)} available
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!loading && outOfStock.length > 0 && (
              <CommandGroup heading="Out of Stock (Check Other Locations)">
                {outOfStock.map((product) => {
                  const alternatives = getAlternativeLocations(product);
                  return (
                    <CommandItem
                      key={product.id}
                      onSelect={() => handleSelect(product)}
                      className="flex flex-col items-start cursor-pointer"
                    >
                      <span className="text-gray-600">
                        <span className="font-mono text-sm">{product.sku}</span>
                        {" - "}
                        {product.name}
                      </span>
                      {alternatives && (
                        <span className="text-xs text-blue-600 mt-1">
                          Available at: {alternatives}
                        </span>
                      )}
                      {!alternatives && (
                        <span className="text-xs text-red-600 mt-1">
                          Out of stock at all locations
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
