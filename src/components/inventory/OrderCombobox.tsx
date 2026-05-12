"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
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
import { ordersApi } from "@/lib/api/orders";
import { useRecentItems } from "@/hooks/use-recent-items";
import { cn } from "@/lib/utils";

export interface OrderPickerRow {
  id: string;
  order_number: string;
  customer_name?: string;
  status: string;
}

interface OrderComboboxProps {
  value?: string;
  onSelect: (order: OrderPickerRow) => void;
  matchTriggerWidth?: boolean;
  className?: string;
  disabled?: boolean;
}

function rowFromApi(o: {
  id: string;
  order_number: string;
  customer_name?: string;
  status: string;
}): OrderPickerRow {
  return {
    id: o.id,
    order_number: o.order_number,
    customer_name: o.customer_name,
    status: o.status,
  };
}

export function OrderCombobox({
  value,
  onSelect,
  matchTriggerWidth = true,
  className,
  disabled = false,
}: OrderComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [listOrders, setListOrders] = useState<OrderPickerRow[]>([]);
  const [searchResults, setSearchResults] = useState<OrderPickerRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [labelOrder, setLabelOrder] = useState<OrderPickerRow | null>(null);
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | undefined>(undefined);

  const { recentItems: recentOrders, addRecentItem: addRecentOrder } = useRecentItems<OrderPickerRow>(
    {
      key: "recent-orders-reservation",
      maxItems: 10,
    }
  );

  const mergedIds = useMemo(() => {
    const m = new Set<string>();
    for (const o of listOrders) m.add(o.id);
    for (const o of searchResults) m.add(o.id);
    return m;
  }, [listOrders, searchResults]);

  const recentInList = useMemo(
    () => recentOrders.filter((r) => mergedIds.has(r.id)),
    [recentOrders, mergedIds]
  );

  const searchQuery = search.trim();
  const searchActive = searchQuery.length >= 2;
  const displayOrders = searchActive ? searchResults : listOrders;
  const mainListOrders = useMemo(() => {
    if (searchActive) return displayOrders;
    const recentIds = new Set(recentInList.map((r) => r.id));
    return displayOrders.filter((o) => !recentIds.has(o.id));
  }, [searchActive, displayOrders, recentInList]);
  const loading = loadingList || loadingSearch;

  useEffect(() => {
    const v = value?.trim() ?? "";
    if (!v) {
      setLabelOrder(null);
      return;
    }
    let cancelled = false;
    void ordersApi
      .get(v)
      .then((o) => {
        if (cancelled) return;
        setLabelOrder(rowFromApi(o));
      })
      .catch(() => {
        if (!cancelled) setLabelOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingList(true);
    void (async () => {
      try {
        const res = await ordersApi.list({ page: 1, page_size: 100 });
        const rows = (res.items || []).map((o) =>
          rowFromApi({
            id: o.id,
            order_number: o.order_number,
            customer_name: o.customer_name,
            status: o.status,
          })
        );
        if (!cancelled) setListOrders(rows);
      } catch (e) {
        console.error("Failed to load orders:", e);
        if (!cancelled) setListOrders([]);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !searchActive) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setLoadingSearch(true);
    void (async () => {
      try {
        const res = await ordersApi.list({
          page: 1,
          page_size: 50,
          search: searchQuery,
        });
        const rows = (res.items || []).map((o) =>
          rowFromApi({
            id: o.id,
            order_number: o.order_number,
            customer_name: o.customer_name,
            status: o.status,
          })
        );
        if (!cancelled) setSearchResults(rows);
      } catch (e) {
        console.error("Order search failed:", e);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setLoadingSearch(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, searchActive, searchQuery]);

  const handleSelect = (order: OrderPickerRow) => {
    setLabelOrder(order);
    onSelect(order);
    addRecentOrder(order);
    setOpen(false);
    setSearch("");
  };

  const emptyMessage = () => {
    if (loading && displayOrders.length === 0) return "Loading orders…";
    if (searchActive && loadingSearch) return "Searching…";
    if (displayOrders.length === 0 && searchActive) return "No orders match that search.";
    if (displayOrders.length === 0 && !searchActive) return "No orders yet. Create one under Operations → Orders.";
    return "";
  };

  useLayoutEffect(() => {
    if (!open || !matchTriggerWidth) {
      setPanelWidth(undefined);
      return;
    }
    const el = triggerWrapRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    if (w > 0) setPanelWidth(w);
  }, [open, matchTriggerWidth]);

  const shown = labelOrder;

  return (
    <div ref={triggerWrapRef} className={cn("w-full", className)}>
      <Popover
        modal={false}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-auto min-h-9 w-full justify-between py-2 text-left font-normal"
          >
            <span className="line-clamp-2 flex-1 pr-2">
              {shown ? (
                <>
                  <span className="font-mono text-xs">{shown.order_number}</span>
                  {shown.customer_name ? (
                    <>
                      <span className="text-muted-foreground"> · </span>
                      <span>{shown.customer_name}</span>
                    </>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">
                  Select order — browse list or type order number
                </span>
              )}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          style={
            matchTriggerWidth && panelWidth
              ? { width: panelWidth, maxWidth: "min(100%, calc(100vw - 2rem))" }
              : undefined
          }
          className={cn(
            "z-[100] overflow-hidden rounded-md border bg-popover p-0 text-popover-foreground shadow-lg",
            matchTriggerWidth
              ? "min-w-0 max-w-[calc(100vw-2rem)]"
              : "w-[min(100vw-2rem,560px)] max-w-[560px]",
            "border-zinc-200 dark:border-zinc-600"
          )}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Filter by order number…"
              value={search}
              onValueChange={setSearch}
              className={cn(
                "h-9 border-0 bg-transparent py-2 text-sm shadow-none",
                "text-foreground placeholder:text-muted-foreground",
                "ring-0 ring-offset-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              )}
            />
            <p className="bg-popover text-muted-foreground border-border border-b px-3 py-2 text-xs">
              {searchActive
                ? "Search matches your order numbers."
                : "Pick a recent order below, or type 2+ characters to search."}
            </p>
            <CommandList className="max-h-[min(60vh,420px)] overflow-y-auto overflow-x-hidden bg-popover">
              {displayOrders.length === 0 &&
                !(recentInList.length > 0 && !searchActive) &&
                (emptyMessage() ? (
                  <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center text-sm dark:text-zinc-400">
                    {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                    {emptyMessage()}
                  </div>
                ) : null)}

              {!loadingList && !searchActive && recentInList.length > 0 && (
                <CommandGroup
                  heading="Recently used"
                  className="text-zinc-900 dark:text-zinc-100 [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
                >
                  {recentInList.map((order) => (
                    <CommandItem
                      key={`recent-${order.id}`}
                      value={`${order.order_number} ${order.customer_name ?? ""}`}
                      onSelect={() => handleSelect(order)}
                      className="cursor-pointer text-zinc-900 aria-selected:bg-zinc-100 dark:text-zinc-50 dark:aria-selected:bg-zinc-800"
                    >
                      <span className="flex w-full min-w-0 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs">{order.order_number}</span>
                          <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                            {order.status}
                          </Badge>
                        </span>
                        {order.customer_name ? (
                          <span className="text-muted-foreground truncate text-xs">
                            {order.customer_name}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && mainListOrders.length > 0 && (
                <CommandGroup
                  heading={searchActive ? "Search results" : "Orders"}
                  className="text-zinc-900 dark:text-zinc-100 [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
                >
                  {mainListOrders.map((order) => (
                    <CommandItem
                      key={order.id}
                      value={`${order.order_number} ${order.customer_name ?? ""} ${order.id}`}
                      onSelect={() => handleSelect(order)}
                      className="cursor-pointer text-zinc-900 aria-selected:bg-zinc-100 dark:text-zinc-50 dark:aria-selected:bg-zinc-800"
                    >
                      <span className="flex w-full min-w-0 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs">{order.order_number}</span>
                          <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                            {order.status}
                          </Badge>
                        </span>
                        {order.customer_name ? (
                          <span className="text-muted-foreground truncate text-xs">
                            {order.customer_name}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
