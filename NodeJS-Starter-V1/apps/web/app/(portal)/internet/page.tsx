"use client";

import { useState, useEffect } from "react";
import { Globe, Package, FileText, User, ShoppingBag, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ProductSearch } from "@/components/portal/ProductSearch";
import { CartManager } from "@/components/portal/CartManager";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

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

interface CartItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  total: number;
  items: any[];
}

interface Quote {
  id: string;
  quote_number: string;
  quote_date: string;
  status: string;
  total: number;
  valid_until: string;
}

export default function InternetPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadOrders();
    loadQuotes();
    loadProducts();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await apiClient.get<{ items: Order[] }>(
        "/api/orders?page_size=10"
      );
      setOrders(response.items || []);
    } catch (error) {
      console.error("Failed to load orders:", error);
    }
  };

  const loadQuotes = async () => {
    try {
      const response = await apiClient.get<{ items: Quote[] }>(
        "/api/quotes?page_size=10"
      );
      setQuotes(response.items || []);
    } catch (error) {
      console.error("Failed to load quotes:", error);
    }
  };

  const loadProducts = async (category?: string) => {
    try {
      const categoryParam = category && category !== "all" ? `&category=${category}` : "";
      const response = await apiClient.get<{ items: Product[] }>(
        `/api/products?page_size=20${categoryParam}`
      );
      setProducts(response.items || []);
    } catch (error) {
      console.error("Failed to load products:", error);
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
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
      toast.success(`Added another ${product.name} to cart`);
    } else {
      if (product.stock === 0) {
        toast.error("Product is out of stock");
        return;
      }
      setCartItems([
        ...cartItems,
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          quantity: 1,
          stock: product.stock,
        },
      ]);
      toast.success(`Added ${product.name} to cart`);
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCartItems(
      cartItems.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== productId));
    toast.success("Item removed from cart");
  };

  const handleClearCart = () => {
    setCartItems([]);
    toast.success("Cart cleared");
  };

  const handleRequestQuote = async () => {
    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setIsLoading(true);

    try {
      // In a real app, customer_id would come from authentication
      const quoteData = {
        customer_id: "mock-customer-id", // Replace with actual authenticated customer
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        status: "pending",
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await apiClient.post<{ id: string; quote_number: string }>(
        "/api/quotes",
        quoteData
      );

      toast.success(
        `Quote ${response.quote_number} created! We'll review and send you a formal quote within 24 hours.`
      );

      setCartItems([]);
      loadQuotes();
    } catch (error: any) {
      console.error("Quote request failed:", error);
      toast.error(error.message || "Failed to request quote");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setIsLoading(true);

    try {
      const subtotal = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const tax = subtotal * 0.1;
      const total = subtotal + tax;

      const orderData = {
        customer_id: "mock-customer-id", // Replace with actual authenticated customer
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal,
        tax,
        total,
        status: "pending",
        channel: "internet",
      };

      const response = await apiClient.post<{ id: string; order_number: string }>(
        "/api/orders",
        orderData
      );

      toast.success(
        `Order ${response.order_number} placed successfully! You'll receive a confirmation email shortly.`
      );

      setCartItems([]);
      loadOrders();
    } catch (error: any) {
      console.error("Order placement failed:", error);
      toast.error(error.message || "Failed to place order");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700",
      pending: "bg-yellow-100 text-yellow-700",
      sent: "bg-blue-100 text-blue-700",
      confirmed: "bg-blue-100 text-blue-700",
      processing: "bg-purple-100 text-purple-700",
      shipped: "bg-indigo-100 text-indigo-700",
      delivered: "bg-green-100 text-green-700",
      accepted: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
      cancelled: "bg-red-100 text-red-700",
      expired: "bg-gray-100 text-gray-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="container py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
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
            <ShoppingBag className="h-4 w-4 mr-2" />
            Catalog
          </TabsTrigger>
          <TabsTrigger value="orders">
            <Package className="h-4 w-4 mr-2" />
            Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="quotes">
            <FileText className="h-4 w-4 mr-2" />
            Quotes ({quotes.length})
          </TabsTrigger>
          <TabsTrigger value="account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
        </TabsList>

        {/* Product Catalog Tab */}
        <TabsContent value="catalog">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Filters & Products */}
            <div className="lg:col-span-2 space-y-6">
              {/* Filters */}
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <Filter className="h-5 w-5 text-muted-foreground" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((product) => (
                  <Card key={product.id} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-primary">
                            ${product.price.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.stock > 10 ? "In stock" : product.stock > 0 ? `${product.stock} left` : "Out of stock"}
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
                  <h3 className="text-lg font-semibold mb-4">Checkout</h3>
                  <div className="space-y-3">
                    <Button
                      onClick={handleRequestQuote}
                      disabled={isLoading}
                      className="w-full"
                      variant="outline"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Request Quote
                    </Button>
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Place Order
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Order History</h2>
            {orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.order_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {order.items?.length || 0} items
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                        <p className="text-lg font-bold mt-2">
                          ${order.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No orders yet. Start shopping to place your first order!
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Quotes Tab */}
        <TabsContent value="quotes">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">My Quotes</h2>
            {quotes.length > 0 ? (
              <div className="space-y-4">
                {quotes.map((quote) => (
                  <Card key={quote.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{quote.quote_number}</p>
                        <p className="text-sm text-muted-foreground">
                          Created: {new Date(quote.quote_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Valid until: {new Date(quote.valid_until).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(quote.status)}>
                          {quote.status}
                        </Badge>
                        <p className="text-lg font-bold mt-2">
                          ${quote.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No quotes yet. Request a quote for bulk orders!
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Account Information</h2>
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
