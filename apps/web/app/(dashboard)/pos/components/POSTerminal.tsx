'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Monitor, CheckCircle2, Search, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Customer } from '@/lib/api/customers';
import { ProductSearch } from './ProductSearch';
import { Cart } from './Cart';
import { PaymentPanel } from './PaymentPanel';
import {
  Location,
  SalesStaff,
  POSTerminal as POSTerminalType,
  CartItem,
  Product,
  PaymentMethod,
  CreateTransactionRequest,
} from '../types';

export function POSTerminal() {
  const { toast } = useToast();

  // State
  const [locations, setLocations] = useState<Location[]>([]);
  const [salesStaff, setSalesStaff] = useState<SalesStaff[]>([]);
  const [terminals, setTerminals] = useState<POSTerminalType[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Optional customer lookup
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const customerSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial data
  const loadPOSData = useCallback(async () => {
    setLoading(true);
    try {
      const [locationsRes, staffRes, terminalsRes] = await Promise.all([
        apiClient.get<Location[]>('/api/pos/locations'),
        apiClient.get<SalesStaff[]>('/api/pos/sales-staff'),
        apiClient.get<POSTerminalType[]>('/api/pos/terminals'),
      ]);

      setLocations(locationsRes.filter((l) => l.location_type === 'physical'));
      setSalesStaff(staffRes.filter((s) => s.is_active));
      setTerminals(terminalsRes.filter((t) => t.is_active));

      // Default to first physical location
      const physicalLocations = locationsRes.filter((l) => l.location_type === 'physical');
      if (physicalLocations.length > 0) {
        setSelectedLocation(physicalLocations[0].code);
      }
    } catch (error) {
      console.error('Failed to load POS data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load POS configuration. Please refresh the page.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPOSData();
  }, [loadPOSData]);

  // Debounced customer search
  const handleCustomerSearchChange = useCallback((value: string) => {
    setCustomerSearch(value);
    setCustomerSearchOpen(true);

    if (customerSearchRef.current) clearTimeout(customerSearchRef.current);

    if (!value.trim()) {
      setCustomerResults([]);
      return;
    }

    customerSearchRef.current = setTimeout(async () => {
      try {
        const result = await apiClient.get<{ items: Customer[] }>(
          `/api/customers?search=${encodeURIComponent(value)}&page_size=8`
        );
        setCustomerResults(result.items ?? []);
      } catch {
        setCustomerResults([]);
      }
    }, 300);
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.company_name);
    setCustomerSearchOpen(false);
    setCustomerResults([]);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerResults([]);
    setCustomerSearchOpen(false);
  };

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
      const unitPrice = Number(product.price);
      return [
        ...prev,
        {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          unit_price: unitPrice,
          subtotal: unitPrice,
        },
      ];
    });

    toast({
      title: 'Added to cart',
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
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a terminal and add items to cart',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const request: CreateTransactionRequest = {
        terminal_id: selectedTerminal,
        sales_staff_id: selectedStaffId || undefined,
        customer_id: selectedCustomer?.id || undefined,
        payment_method: method,
        amount: total,
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };

      const response = await apiClient.post<{ transaction_number: string; payment_status: string }>(
        '/api/pos/transactions',
        request
      );

      if (response.payment_status === 'captured') {
        setLastTransaction(response.transaction_number);
        setCartItems([]);
        toast({
          title: 'Payment Successful',
          description: `Transaction ${response.transaction_number} completed`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Payment Failed',
          description: 'The payment could not be processed. Please try again.',
        });
      }
    } catch (error) {
      console.error('Payment failed:', error);
      toast({
        variant: 'destructive',
        title: 'Payment Error',
        description: 'An error occurred while processing the payment.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center lg:h-[600px]">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2" />
          <p className="text-muted-foreground">Loading POS Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Terminal Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Location Selector */}
          <div className="flex items-center gap-2">
            <MapPin className="text-muted-foreground h-5 w-5" />
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
            <Monitor className="text-muted-foreground h-5 w-5" />
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
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Terminal Online
          </Badge>
          {lastTransaction && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Last: {lastTransaction}
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Optional customer lookup */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <Input
            placeholder="Customer (optional — leave blank for walk-in)"
            value={customerSearch}
            onChange={(e) => handleCustomerSearchChange(e.target.value)}
            onFocus={() => customerSearch && setCustomerSearchOpen(true)}
            className="flex-1"
          />
          {selectedCustomer && (
            <button
              type="button"
              onClick={handleClearCustomer}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear customer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {customerSearchOpen && customerResults.length > 0 && (
          <div className="bg-background border-border absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border shadow-md">
            {customerResults.map((c) => (
              <button
                key={c.id}
                type="button"
                className="hover:bg-accent w-full px-4 py-2 text-left text-sm"
                onClick={() => handleSelectCustomer(c)}
              >
                <span className="font-medium">{c.company_name}</span>
                {c.customer_number && (
                  <span className="text-muted-foreground ml-2 text-xs">#{c.customer_number}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile: tabbed layout */}
      <div className="lg:hidden">
        <Tabs defaultValue="products">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="cart">
              Cart{cartItems.length > 0 ? ` (${cartItems.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Products</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductSearch onAddProduct={handleAddProduct} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cart">
            <Card>
              <CardContent className="p-4">
                <Cart
                  items={cartItems}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onClearCart={handleClearCart}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="payment">
            <PaymentPanel
              total={total}
              items={cartItems}
              salesStaff={locationStaff}
              selectedStaffId={selectedStaffId}
              onSelectStaff={setSelectedStaffId}
              onProcessPayment={handleProcessPayment}
              isProcessing={isProcessing}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: 3-panel grid */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-12">
        {/* Product Search - Left Panel */}
        <div className="lg:col-span-5">
          <Card className="h-[600px]">
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
          <Card className="h-[600px]">
            <CardContent className="h-full p-4">
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
