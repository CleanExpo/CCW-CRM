"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Command,
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
import { useRecentItems } from "@/hooks/use-recent-items";
import { cn } from "@/lib/utils";

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
  /** Aggregate stock from catalog API when per-location rows are not loaded */
  stock?: number;
  stock_by_location?: StockByLocation[];
}

interface LocationAwareProductSelectProps {
  selectedLocation?: string;
  onSelect: (product: Product) => void;
  value?: string;
}

function getStockAtLocation(product: Product, location: string): number {
  if (product.stock_by_location?.length) {
    const hit = product.stock_by_location.find(
      (s) => s.location.toLowerCase() === location.toLowerCase()
    );
    if (hit && typeof hit.available === "number") return hit.available;
  }
  return typeof product.stock === "number" ? product.stock : 0;
}

export function LocationAwareProductSelect({
  selectedLocation = "brisbane",
  onSelect,
  value,
}: LocationAwareProductSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { recentItems: recentProducts, addRecentItem: addRecentProduct } =
    useRecentItems<Product>({
      key: "recent-products",
      maxItems: 10,
    });

  const searchQuery = search.trim();
  const searchActive = searchQuery.length >= 2;

  const displayProducts = searchActive ? searchResults : catalogProducts;
  const loading = loadingCatalog || loadingSearch;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingCatalog(true);
    void (async () => {
      try {
        const response = await apiClient.get<{ items: Product[] }>(
          `/api/products?page=1&page_size=100`
        );
        const items = response.items || [];
        const sorted = [...items].sort(
          (a, b) =>
            getStockAtLocation(b, selectedLocation) -
            getStockAtLocation(a, selectedLocation)
        );
        if (!cancelled) setCatalogProducts(sorted);
      } catch (e) {
        console.error("Failed to load products:", e);
        if (!cancelled) setCatalogProducts([]);
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selectedLocation]);

  useEffect(() => {
    if (!open || !searchActive) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const q = searchQuery;
    const handle = setTimeout(() => {
      void (async () => {
        setLoadingSearch(true);
        try {
          const response = await apiClient.get<{ items: Product[] }>(
            `/api/products?search=${encodeURIComponent(q)}&page_size=50`
          );
          const raw = response.items || [];
          const enriched = await Promise.all(
            raw.map(async (product) => {
              try {
                const stockResponse = await apiClient.get<{ locations: StockByLocation[] }>(
                  `/api/inventory/product/${product.id}/locations`
                );
                const stockData = stockResponse.locations || [];
                return {
                  ...product,
                  stock: product.stock,
                  stock_by_location: Array.isArray(stockData) ? stockData : [],
                };
              } catch {
                return {
                  ...product,
                  stock: product.stock,
                  stock_by_location: [],
                };
              }
            })
          );
          enriched.sort(
            (a, b) =>
              getStockAtLocation(b, selectedLocation) -
              getStockAtLocation(a, selectedLocation)
          );
          if (!cancelled) setSearchResults(enriched);
        } catch (e) {
          console.error("Product search failed:", e);
          if (!cancelled) setSearchResults([]);
        } finally {
          if (!cancelled) setLoadingSearch(false);
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, searchActive, searchQuery, selectedLocation]);

  useEffect(() => {
    if (!value) {
      setSelectedProduct(null);
      return;
    }
    const match = [...catalogProducts, ...searchResults].find((p) => p.id === value);
    if (match) setSelectedProduct(match);
  }, [value, catalogProducts, searchResults]);

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

  const { inStock, lowStock, outOfStock } = useMemo(() => {
    const inn: Product[] = [];
    const low: Product[] = [];
    const out: Product[] = [];
    for (const p of displayProducts) {
      const st = getStockAtLocation(p, selectedLocation);
      if (st > 10) inn.push(p);
      else if (st > 0) low.push(p);
      else out.push(p);
    }
    return { inStock: inn, lowStock: low, outOfStock: out };
  }, [displayProducts, selectedLocation]);

  const handleSelect = (product: Product) => {
    setSelectedProduct(product);
    onSelect(product);
    addRecentProduct(product);
    setOpen(false);
    setSearch("");
  };

  const emptyMessage = () => {
    if (loading && displayProducts.length === 0) return "Loading products…";
    if (searchActive && loadingSearch) return "Searching…";
    if (displayProducts.length === 0 && searchActive) return "No products match your search.";
    if (displayProducts.length === 0 && !searchActive)
      return "No products in catalog. Add products under Inventory.";
    return "";
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-9 w-full justify-between py-2 text-left font-normal"
        >
          <span className="line-clamp-2 flex-1 pr-2">
            {selectedProduct ? (
              <>
                <span className="font-mono text-xs">{selectedProduct.sku}</span>
                <span className="text-muted-foreground"> · </span>
                <span>{selectedProduct.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">
                Select product — browse list or type to search
              </span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[min(100vw-2rem,560px)] max-w-[560px] border-zinc-200 bg-white p-0 text-zinc-950 shadow-lg",
          "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
        )}
        align="start"
      >
        <Command shouldFilter={false} className="bg-transparent dark:bg-transparent">
          <CommandInput
            placeholder="Filter by SKU or product name…"
            value={search}
            onValueChange={setSearch}
            className="h-10 border-zinc-200 bg-zinc-50/80 text-zinc-950 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-950/80 dark:text-zinc-50 dark:placeholder:text-zinc-400"
          />
          <p className="text-muted-foreground border-b border-zinc-200 px-3 py-2 text-xs dark:border-zinc-600 dark:text-zinc-400">
            {searchActive
              ? "Search results include per-location stock where available."
              : "Browse the catalog below, or type 2+ characters to search all products."}
          </p>
          <CommandList className="max-h-[min(60vh,420px)] overflow-y-auto">
            {displayProducts.length === 0 &&
              !(recentProducts.length > 0 && !searchActive) &&
              (emptyMessage() ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center text-sm dark:text-zinc-400">
                  {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                  {emptyMessage()}
                </div>
              ) : null)}

            {!loadingCatalog && !searchActive && recentProducts.length > 0 && (
                <CommandGroup
                  heading="Recently used"
                  className="text-zinc-900 dark:text-zinc-100 [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
                >
                  {recentProducts.map((product) => {
                    const stockAtLocation = getStockAtLocation(product, selectedLocation);
                    return (
                      <CommandItem
                        key={`recent-${product.id}`}
                        value={`${product.sku} ${product.name}`}
                        onSelect={() => handleSelect(product)}
                        className="cursor-pointer text-zinc-900 aria-selected:bg-zinc-100 dark:text-zinc-50 dark:aria-selected:bg-zinc-800"
                      >
                        <span className="flex flex-1 justify-between gap-2">
                          <span className="min-w-0">
                            <span className="font-mono text-xs">{product.sku}</span>
                            <span className="text-muted-foreground"> · </span>
                            {product.name}
                          </span>
                          {stockAtLocation > 0 && (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {stockAtLocation} at {selectedLocation}
                            </Badge>
                          )}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

            {!loading && inStock.length > 0 && (
              <CommandGroup
                heading={`In stock at ${selectedLocation}`}
                className="text-zinc-900 dark:text-zinc-100 [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
              >
                {inStock.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`${product.sku} ${product.name}`}
                    onSelect={() => handleSelect(product)}
                    className="cursor-pointer text-zinc-900 aria-selected:bg-zinc-100 dark:text-zinc-50 dark:aria-selected:bg-zinc-800"
                  >
                    <span className="flex w-full justify-between gap-2">
                      <span className="min-w-0">
                        <span className="font-mono text-xs">{product.sku}</span>
                        <span className="text-muted-foreground"> · </span>
                        {product.name}
                      </span>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {getStockAtLocation(product, selectedLocation)} available
                      </Badge>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!loading && lowStock.length > 0 && (
              <CommandGroup
                heading="Low stock"
                className="text-zinc-900 dark:text-zinc-100 [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
              >
                {lowStock.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`${product.sku} ${product.name}`}
                    onSelect={() => handleSelect(product)}
                    className="cursor-pointer text-zinc-900 aria-selected:bg-zinc-100 dark:text-zinc-50 dark:aria-selected:bg-zinc-800"
                  >
                    <span className="flex w-full justify-between gap-2">
                      <span className="min-w-0">
                        <span className="font-mono text-xs">{product.sku}</span>
                        <span className="text-muted-foreground"> · </span>
                        {product.name}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {getStockAtLocation(product, selectedLocation)} available
                      </Badge>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!loading && outOfStock.length > 0 && (
              <CommandGroup
                heading="Out of stock here (may be available elsewhere)"
                className="text-zinc-900 dark:text-zinc-100 [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
              >
                {outOfStock.map((product) => {
                  const alternatives = getAlternativeLocations(product);
                  return (
                    <CommandItem
                      key={product.id}
                      value={`${product.sku} ${product.name}`}
                      onSelect={() => handleSelect(product)}
                      className="cursor-pointer flex-col items-stretch gap-0.5 text-zinc-900 aria-selected:bg-zinc-100 dark:text-zinc-50 dark:aria-selected:bg-zinc-800"
                    >
                      <span className="flex w-full justify-between gap-2">
                        <span className="min-w-0">
                          <span className="font-mono text-xs">{product.sku}</span>
                          <span className="text-muted-foreground"> · </span>
                          {product.name}
                        </span>
                      </span>
                      {alternatives ? (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          Available at: {alternatives}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          None at this location — still selectable for ordering
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
