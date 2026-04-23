"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { MapPin, Monitor, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { ProductSearch } from "./ProductSearch";
import { Cart } from "./Cart";
import { PaymentPanel } from "./PaymentPanel";
import {
  Location,
  SalesStaff,
  POSTerminal as POSTerminalType,
  CartItem,
  Product,
  PaymentMethod,
  CreateTransactionRequest,
} from "../types";
import { opCardClass, opHeroSurfaceClass } from "@/lib/operations/ui";
import { cn } from "@/lib/utils";

export function POSTerminal() {
  const { toast } = useToast();

  // State
  const [locations, setLocations] = useState<Location[]>([]);
  const [salesStaff, setSalesStaff] = useState<SalesStaff[]>([]);
  const [terminals, setTerminals] = useState<POSTerminalType[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedTerminal, setSelectedTerminal] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load initial data
  const loadPOSData = useCallback(async () => {
    setLoading(true);
    try {
      const [locationsRes, staffRes, terminalsRes] = await Promise.all([
        apiClient.get<Location[]>("/api/pos/locations"),
        apiClient.get<SalesStaff[]>("/api/pos/sales-staff"),
        apiClient.get<POSTerminalType[]>("/api/pos/terminals"),
      ]);

      setLocations(locationsRes.filter((l) => l.location_type === "physical"));
      setSalesStaff(staffRes.filter((s) => s.is_active));
      setTerminals(terminalsRes.filter((t) => t.is_active));

      // Default to first physical location
      const physicalLocations = locationsRes.filter((l) => l.location_type === "physical");
      if (physicalLocations.length > 0) {
        setSelectedLocation(physicalLocations[0].code);
      }
    } catch (error) {
      console.error("Failed to load POS data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load POS configuration. Please refresh the page.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPOSData();
  }, [loadPOSData]);

  // Filter terminals by selected location
  const locationTerminals = terminals.filter((t) => t.location_code === selectedLocation);

  // Auto-select first terminal when location changes
  useEffect(() => {
    if (locationTerminals.length > 0 && !locationTerminals.find((t) => t.id === selectedTerminal)) {
      setSelectedTerminal(locationTerminals[0].id);
    }
  }, [selectedLocation, locationTerminals, selectedTerminal]);

  // Filter staff by selected location
  const locationStaff = salesStaff.filter((s) => s.primary_location_code === selectedLocation);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  // Add product to cart
  const handleAddProduct = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.unit_price,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          unit_price: product.price,
          subtotal: product.price,
        },
      ];
    });

    toast({
      title: "Added to cart",
      description: `${product.name} added`,
    });
  };

  // Update item quantity
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity, subtotal: quantity * item.unit_price }
          : item
      )
    );
  };

  // Remove item from cart
  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  // Clear cart
  const handleClearCart = () => {
    setCartItems([]);
  };

  // Process payment
  const handleProcessPayment = async (method: PaymentMethod) => {
    if (!selectedTerminal || cartItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a terminal and add items to cart",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const request: CreateTransactionRequest = {
        terminal_id: selectedTerminal,
        sales_staff_id: selectedStaffId || undefined,
        payment_method: method,
        amount: total,
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };

      const response = await apiClient.post<{ transaction_number: string; payment_status: string }>(
        "/api/pos/transactions",
        request
      );

      if (response.payment_status === "captured") {
        setLastTransaction(response.transaction_number);
        setCartItems([]);
        toast({
          title: "Payment Successful",
          description: `Transaction ${response.transaction_number} completed`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Payment Failed",
          description: "The payment could not be processed. Please try again.",
        });
      }
    } catch (error) {
      console.error("Payment failed:", error);
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: "An error occurred while processing the payment.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading POS Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Terminal Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="text-muted-foreground h-5 w-5 shrink-0 dark:text-foreground/60" />
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.code} value={location.code}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Terminal Selector */}
          <div className="flex items-center gap-2">
            <Monitor className="text-muted-foreground h-5 w-5 shrink-0 dark:text-foreground/60" />
            <Select value={selectedTerminal} onValueChange={setSelectedTerminal}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select terminal" />
              </SelectTrigger>
              <SelectContent>
                {locationTerminals.map((terminal) => (
                  <SelectItem key={terminal.id} value={terminal.id}>
                    {terminal.terminal_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Terminal online
          </Badge>
          {lastTransaction && (
            <Badge variant="secondary" className="gap-1 font-mono text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Last: {lastTransaction}
            </Badge>
          )}
        </div>
      </div>

      <Separator className="bg-border/80" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Card className={cn("flex h-[min(70vh,600px)] flex-col", opCardClass, opHeroSurfaceClass)}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Products</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductSearch onAddProduct={handleAddProduct} />
            </CardContent>
          </Card>
        </div>

        {/* Cart - Middle Panel */}
        <div className="lg:col-span-4">
          <Card className={cn("h-[min(70vh,600px)]", opCardClass, opHeroSurfaceClass)}>
            <CardContent className="flex h-full flex-col p-4">
              <Cart
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onClearCart={handleClearCart}
              />
            </CardContent>
          </Card>
        </div>

        {/* Payment - Right Panel */}
        <div className="lg:col-span-3">
          <PaymentPanel
            total={total}
            items={cartItems}
            salesStaff={locationStaff}
            selectedStaffId={selectedStaffId}
            onSelectStaff={setSelectedStaffId}
            onProcessPayment={handleProcessPayment}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    </div>
  );
}
