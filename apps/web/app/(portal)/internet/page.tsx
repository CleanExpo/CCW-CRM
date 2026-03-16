'use client';

import { useState, useEffect } from 'react';
import { Globe, Package, FileText, User, ShoppingBag, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ProductSearch } from '@/components/portal/ProductSearch';
import { CartManager } from '@/components/portal/CartManager';
import { CustomerLookup } from '@/components/portal/CustomerLookup';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number | string; // Backend returns string, but we'll convert to number
  stock: number;
  warehouse_location: string;
}

interface CartItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

interface OrderItem {
  id?: string;
  product_id?: string;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
}

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total: number | string; // Backend returns string
  items?: OrderItem[];
}

interface Quote {
  id: string;
  quote_number: string;
  quote_date: string;
  status: string;
  total: number | string; // Backend returns string
  valid_until: string;
}

interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
}

export default function InternetPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure client-side only rendering to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load initial data only after component is mounted
  useEffect(() => {
    if (mounted) {
      loadOrders();
      loadQuotes();
      loadProducts();
    }
  }, [mounted]);

  const loadOrders = async () => {
    try {
      const response = await apiClient.get<{ data: Order[] }>('/api/demo/orders?page_size=10');
      // Convert string totals to numbers
      const ordersWithNumericTotals = (response.data || []).map((o) => ({
        ...o,
        total: typeof o.total === 'string' ? parseFloat(o.total) : o.total,
      }));
      setOrders(ordersWithNumericTotals);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const loadQuotes = async () => {
    try {
      const response = await apiClient.get<{ data: Quote[] }>('/api/demo/quotes?page_size=10');
      // Convert string totals to numbers
      const quotesWithNumericTotals = (response.data || []).map((q) => ({
        ...q,
        total: typeof q.total === 'string' ? parseFloat(q.total) : q.total,
      }));
      setQuotes(quotesWithNumericTotals);
    } catch (error) {
      console.error('Failed to load quotes:', error);
    }
  };

  const loadProducts = async (category?: string) => {
    try {
      const categoryParam = category && category !== 'all' ? `&category=${category}` : '';
      const response = await apiClient.get<{ data: Product[] }>(
        `/api/demo/products?page_size=20${categoryParam}`
      );
      // Convert string prices to numbers
      const productsWithNumericPrices = (response.data || []).map((p) => ({
        ...p,
        price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
      }));
      setProducts(productsWithNumericPrices);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    loadProducts(category);
  };

  const handleProductSelect = (product: Product) => {
    const existingItem = cartItems.find((item) => item.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast.error(`Only ${product.stock} units available in stock`);
        return;
      }
      setCartItems(
        cartItems.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
      toast.success(`Added another ${product.name} to cart`);
    } else {
      if (product.stock === 0) {
        toast.error('Product is out of stock');
        return;
      }
      setCartItems([
        ...cartItems,
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
          quantity: 1,
          stock: product.stock,
        },
      ]);
      toast.success(`Added ${product.name} to cart`);
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCartItems(cartItems.map((item) => (item.id === productId ? { ...item, quantity } : item)));
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== productId));
    toast.success('Item removed from cart');
  };

  const handleClearCart = () => {
    setCartItems([]);
    toast.success('Cart cleared');
  };

  const noteTemplates = [
    'Need bulk pricing',
    'Call before delivery',
    'Deliver to site address on file',
    'Project deadline in 30 days',
  ];

  const appendCheckoutNote = (template: string) => {
    setCheckoutNotes((prev) => {
      const trimmed = prev.trim();
      if (trimmed.includes(template)) {
        return prev;
      }
      return trimmed ? `${trimmed}\n${template}` : template;
    });
  };

  const handleRequestQuote = async () => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (!selectedCustomer) {
      toast.error('Select a customer to request a quote.');
      return;
    }

    setIsLoading(true);

    try {
      const notes = checkoutNotes.trim();
      // In a real app, customer_id would come from authentication
      const quoteData = {
        customer_id: selectedCustomer.id,
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        status: 'pending',
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: notes || undefined,
      };

      const response = await apiClient.post<{ id: string; quote_number: string }>(
        '/api/quotes',
        quoteData
      );

      toast.success(
        `Quote ${response.quote_number} created! We'll review and send you a formal quote within 24 hours.`
      );

      setCartItems([]);
      setCheckoutNotes('');
      loadQuotes();
    } catch (error) {
      console.error('Quote request failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to request quote';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (!selectedCustomer) {
      toast.error('Select a customer to place an order.');
      return;
    }

    setIsLoading(true);

    try {
      const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const tax = subtotal * 0.1;
      const total = subtotal + tax;
      const notes = checkoutNotes.trim();

      const orderData = {
        customer_id: selectedCustomer.id,
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal,
        tax,
        total,
        status: 'pending',
        channel: 'internet',
        notes: notes || undefined,
      };

      const response = await apiClient.post<{ id: string; order_number: string }>(
        '/api/orders',
        orderData
      );

      toast.success(
        `Order ${response.order_number} placed successfully! You'll receive a confirmation email shortly.`
      );

      setCartItems([]);
      setCheckoutNotes('');
      loadOrders();
    } catch (error) {
      console.error('Order placement failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to place order';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      sent: 'bg-blue-100 text-blue-700',
      confirmed: 'bg-blue-100 text-blue-700',
      processing: 'bg-purple-100 text-purple-700',
      shipped: 'bg-indigo-100 text-indigo-700',
      delivered: 'bg-green-100 text-green-700',
      accepted: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      cancelled: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  // Don't render interactive content until mounted on client to prevent hydration errors
  if (!mounted) {
    return (
      <div className="container px-4 py-8">
        <div className="mb-6">
          <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold">
            <Globe className="h-8 w-8" />
            Order Cleaning Equipment Online — Australia-Wide Shipping
          </h1>
          <p className="text-muted-foreground">
            Browse professional carpet cleaning machines, chemicals, and restoration equipment.
            Australia-wide delivery from CCW Online.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="text-muted-foreground mt-4">Loading portal...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold">
          <Globe className="h-8 w-8" />
          Online Portal
        </h1>
        <p className="text-muted-foreground">
          Browse products, track orders, and manage quotes online.
        </p>
      </div>

      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="catalog">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Catalog
          </TabsTrigger>
          <TabsTrigger value="orders">
            <Package className="mr-2 h-4 w-4" />
            Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="quotes">
            <FileText className="mr-2 h-4 w-4" />
            Quotes ({quotes.length})
          </TabsTrigger>
          <TabsTrigger value="account">
            <User className="mr-2 h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        {/* Product Catalog Tab */}
        <TabsContent value="catalog">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: Filters & Products */}
            <div className="space-y-6 lg:col-span-2">
              {/* Filters */}
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <Filter className="text-muted-foreground h-5 w-5" />
                  <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="heavy_machinery">Heavy Machinery</SelectItem>
                      <SelectItem value="hand_tools">Hand Tools</SelectItem>
                      <SelectItem value="power_tools">Power Tools</SelectItem>
                      <SelectItem value="safety_equipment">Safety Equipment</SelectItem>
                      <SelectItem value="building_materials">Building Materials</SelectItem>
                      <SelectItem value="electrical">Electrical</SelectItem>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="accessories">Accessories</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              {/* Product Search */}
              <Card className="p-6">
                <ProductSearch
                  onProductSelect={handleProductSelect}
                  placeholder="Search for products..."
                  autoFocus={false}
                />
              </Card>

              {/* Product Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {products.map((product) => (
                  <Card key={product.id} className="p-4 transition-shadow hover:shadow-lg">
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-muted-foreground text-xs">SKU: {product.sku}</p>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {product.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-primary text-lg font-bold">
                            $
                            {(typeof product.price === 'string'
                              ? parseFloat(product.price)
                              : product.price
                            ).toFixed(2)}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {product.stock > 10
                              ? 'In stock'
                              : product.stock > 0
                                ? `${product.stock} left`
                                : 'Out of stock'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleProductSelect(product)}
                          disabled={product.stock === 0}
                        >
                          Add to Cart
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Right: Cart */}
            <div className="space-y-6">
              <CustomerLookup
                onCustomerSelect={setSelectedCustomer}
                selectedCustomer={selectedCustomer}
              />

              <CartManager
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onClearCart={handleClearCart}
                taxRate={0.1}
                showTax={true}
              />

              {cartItems.length > 0 && (
                <Card className="p-6">
                  <h3 className="mb-4 text-lg font-semibold">Checkout</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="checkout_notes">Order notes (optional)</Label>
                      <Textarea
                        id="checkout_notes"
                        value={checkoutNotes}
                        onChange={(event) => setCheckoutNotes(event.target.value)}
                        placeholder="Add context for the sales team..."
                        rows={3}
                      />
                      <div className="flex flex-wrap gap-2">
                        {noteTemplates.map((template) => (
                          <Button
                            key={template}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => appendCheckoutNote(template)}
                          >
                            {template}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button
                        onClick={handleRequestQuote}
                        disabled={isLoading || !selectedCustomer}
                        className="w-full"
                        variant="outline"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Request Quote
                      </Button>
                      <Button
                        onClick={handlePlaceOrder}
                        disabled={isLoading || !selectedCustomer}
                        className="w-full"
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Place Order
                      </Button>
                    </div>

                    {!selectedCustomer && (
                      <p className="text-muted-foreground text-sm">
                        Select a customer to enable checkout.
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card className="p-6">
            <h2 className="mb-4 text-2xl font-bold">Your Cleaning Equipment Order History</h2>
            {orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{order.order_number}</p>
                        <p className="text-muted-foreground text-sm" suppressHydrationWarning>
                          {new Date(order.order_date).toLocaleDateString()}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {order.items?.length || 0} items
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                        <p className="mt-2 text-lg font-bold">
                          $
                          {(typeof order.total === 'string'
                            ? parseFloat(order.total)
                            : order.total
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center">
                No orders yet. Start shopping to place your first order!
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Quotes Tab */}
        <TabsContent value="quotes">
          <Card className="p-6">
            <h2 className="mb-4 text-2xl font-bold">My Equipment Quotes</h2>
            {quotes.length > 0 ? (
              <div className="space-y-4">
                {quotes.map((quote) => (
                  <Card key={quote.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{quote.quote_number}</p>
                        <p className="text-muted-foreground text-sm" suppressHydrationWarning>
                          Created: {new Date(quote.quote_date).toLocaleDateString()}
                        </p>
                        <p className="text-muted-foreground text-xs" suppressHydrationWarning>
                          Valid until: {new Date(quote.valid_until).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(quote.status)}>{quote.status}</Badge>
                        <p className="mt-2 text-lg font-bold">
                          $
                          {(typeof quote.total === 'string'
                            ? parseFloat(quote.total)
                            : quote.total
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center">
                No quotes yet. Request a quote for bulk orders!
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <Card className="p-6">
            <h2 className="mb-4 text-2xl font-bold">Account Information</h2>
            <p className="text-muted-foreground">
              Account management features coming soon. For now, contact support for account updates.
            </p>
            <Separator className="my-6" />
            <div className="space-y-4">
              <Button variant="outline" className="w-full">
                Update Profile
              </Button>
              <Button variant="outline" className="w-full">
                Download Invoices
              </Button>
              <Button variant="outline" className="w-full">
                Support Tickets
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
