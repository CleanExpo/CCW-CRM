"use client";

import { useState } from "react";
import { ShoppingCart, CreditCard, Banknote, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProductSearch } from "@/components/portal/ProductSearch";
import { CartManager } from "@/components/portal/CartManager";
import { CustomerLookup } from "@/components/portal/CustomerLookup";
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

export default function WalkInPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [guestCustomerId, setGuestCustomerId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add product to cart
  const handleProductSelect = (product: Product) => {
    const existingItem = cartItems.find((item) => item.id === product.id);

    if (existingItem) {
      // Increment quantity if already in cart
      if (existingItem.quantity >= product.stock) {
        toast.error(`Only ${product.stock} units available in stock`);
        return;
      }
      setCartItems(
        cartItems.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
      toast.success(`Added another ${product.name} to cart`);
    } else {
      // Add new item to cart
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

  // Update item quantity
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCartItems(
      cartItems.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  // Remove item from cart
  const handleRemoveItem = (productId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== productId));
    toast.success("Item removed from cart");
  };

  // Clear entire cart
  const handleClearCart = () => {
    setCartItems([]);
    toast.success("Cart cleared");
  };

  const resolveCustomerId = async () => {
    if (selectedCustomer) {
      return selectedCustomer.id;
    }

    if (guestCustomerId) {
      return guestCustomerId;
    }

    const guestPayload = {
      customer_number: `WALK-${Date.now()}`,
      company_name: "Walk-In Guest",
      contact_name: "Guest",
    };

    const created = await apiClient.post<Customer>("/api/customers", guestPayload);
    setGuestCustomerId(created.id);
    toast.info("Using guest profile for this order.");
    return created.id;
  };

  // Process payment
  const handlePayment = async (paymentMethod: "cash" | "card" | "account") => {
    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (paymentMethod === "account" && !selectedCustomer) {
      toast.error("Select or create a customer for account billing.");
      return;
    }

    setIsProcessing(true);

    try {
      const customerId = await resolveCustomerId();
      // Create order
      const orderData = {
        customer_id: customerId,
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: cartItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        tax: cartItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ) * 0.1,
        total:
          cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0) *
          1.1,
        status: paymentMethod === "account" ? "pending" : "confirmed",
        payment_method: paymentMethod,
        channel: "walk-in",
      };

      const response = await apiClient.post<{ id: string; order_number: string }>(
        "/api/orders",
        orderData
      );

      // Success - show confirmation
      toast.success(
        `Order ${response.order_number} completed! ${
          paymentMethod === "account" ? "Invoice will be sent." : ""
        }`
      );

      // Clear cart after successful order
      setCartItems([]);
      // Optionally print receipt
      if (paymentMethod !== "account") {
        toast.info("Receipt ready to print");
      }
    } catch (error) {
      console.error("Order creation failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to process order. Please try again.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  return (
    <div className="container py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Walk-In Checkout</h1>
        <p className="text-muted-foreground">
          Fast checkout for in-store customers. Scan or search for products.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Product Search */}
        <div className="space-y-6">
          <CustomerLookup
            onCustomerSelect={setSelectedCustomer}
            selectedCustomer={selectedCustomer}
          />

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Add Products
            </h2>

            <ProductSearch
              onProductSelect={handleProductSelect}
              placeholder="Scan barcode or search by SKU, name..."
              autoFocus={true}
            />

            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Quick Tips:</strong>
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>- Use barcode scanner or type SKU</li>
                <li>- Press Enter to add to cart</li>
                <li>- Item already in cart- Quantity will increment</li>
              </ul>
            </div>
          </Card>
        </div>

        {/* Right Column: Cart & Checkout */}
        <div className="space-y-6">
          <CartManager
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            taxRate={0.1}
            showTax={true}
          />

          {/* Payment Options */}
          {cartItems.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Payment Method</h3>

              <div className="space-y-3">
                <Button
                  onClick={() => handlePayment("cash")}
                  disabled={isProcessing}
                  className="w-full h-16 text-lg"
                  variant="default"
                >
                  <Banknote className="h-6 w-6 mr-2" />
                  Cash
                </Button>

                <Button
                  onClick={() => handlePayment("card")}
                  disabled={isProcessing}
                  className="w-full h-16 text-lg"
                  variant="default"
                >
                  <CreditCard className="h-6 w-6 mr-2" />
                  Card
                </Button>

                <Button
                  onClick={() => handlePayment("account")}
                  disabled={isProcessing || !selectedCustomer}
                  className="w-full h-16 text-lg"
                  variant="outline"
                >
                  <Building2 className="h-6 w-6 mr-2" />
                  Account (Invoice)
                </Button>
              </div>

              {!selectedCustomer && (
                <p className="text-sm text-muted-foreground mt-3">
                  No customer selected. Cash or card will use a guest profile. Add a
                  customer for account billing.
                </p>
              )}

              <Separator className="my-4" />

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Total to pay:</span>
                <span className="text-2xl font-bold text-foreground">
                  ${total.toFixed(2)}
                </span>
              </div>

              {isProcessing && (
                <p className="text-sm text-center text-muted-foreground mt-4">
                  Processing order...
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
