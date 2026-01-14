"use client";

import { useState } from "react";
import { Phone, FileText, Check, Clock, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

export default function PhonePage() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [callNotes, setCallNotes] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<string>("pickup");
  const [isProcessing, setIsProcessing] = useState(false);

  // Add product to cart
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

  // Create quote
  const handleSaveAsQuote = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer first");
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setIsProcessing(true);

    try {
      const quoteData = {
        customer_id: selectedCustomer.id,
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        notes: callNotes,
        status: "sent",
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      };

      const response = await apiClient.post<{ id: string; quote_number: string }>(
        "/api/quotes",
        quoteData
      );

      toast.success(
        `Quote ${response.quote_number} created and will be sent to ${selectedCustomer.email}`
      );

      // Reset form
      setCartItems([]);
      setCallNotes("");
    } catch (error: any) {
      console.error("Quote creation failed:", error);
      toast.error(error.message || "Failed to create quote");
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm order
  const handleConfirmOrder = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer first");
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setIsProcessing(true);

    try {
      const subtotal = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const tax = subtotal * 0.1;
      const total = subtotal + tax;

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
        status: "confirmed",
        notes: `${callNotes}\n\nDelivery method: ${deliveryMethod}`,
        channel: "phone",
      };

      const response = await apiClient.post<{ id: string; order_number: string }>(
        "/api/orders",
        orderData
      );

      toast.success(
        `Order ${response.order_number} confirmed! Invoice will be sent to ${selectedCustomer.email}`
      );

      // Reset form
      setCartItems([]);
      setCallNotes("");
      setDeliveryMethod("pickup");
    } catch (error: any) {
      console.error("Order creation failed:", error);
      toast.error(error.message || "Failed to create order");
    } finally {
      setIsProcessing(false);
    }
  };

  // Hold for confirmation
  const handleHoldForConfirmation = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer first");
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setIsProcessing(true);

    try {
      const subtotal = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const tax = subtotal * 0.1;
      const total = subtotal + tax;

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
        status: "pending",
        notes: `${callNotes}\n\nDelivery method: ${deliveryMethod}\n\nAwaiting customer confirmation`,
        channel: "phone",
      };

      const response = await apiClient.post<{ id: string; order_number: string }>(
        "/api/orders",
        orderData
      );

      toast.success(
        `Order ${response.order_number} saved as pending. Awaiting customer confirmation.`
      );

      // Reset form
      setCartItems([]);
      setCallNotes("");
      setDeliveryMethod("pickup");
    } catch (error: any) {
      console.error("Order creation failed:", error);
      toast.error(error.message || "Failed to save order");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Phone className="h-8 w-8" />
          Phone Orders
        </h1>
        <p className="text-muted-foreground">
          Optimized for call center agents. Search customer, build order during conversation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Product Search */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Lookup */}
          <CustomerLookup
            onCustomerSelect={setSelectedCustomer}
            selectedCustomer={selectedCustomer}
          />

          {/* Product Search */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Add Products</h2>
            <ProductSearch
              onProductSelect={handleProductSelect}
              placeholder="Search by SKU or product name..."
              autoFocus={false}
            />
          </Card>

          {/* Call Notes */}
          <Card className="p-6">
            <Label htmlFor="notes" className="text-lg font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Enter notes from phone conversation..."
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              rows={4}
              className="mt-2"
            />
          </Card>

          {/* Delivery Options */}
          <Card className="p-6">
            <Label htmlFor="delivery" className="text-lg font-semibold mb-2">
              Delivery Method
            </Label>
            <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
              <SelectTrigger id="delivery" className="mt-2">
                <SelectValue placeholder="Select delivery method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="ship">Ship</SelectItem>
              </SelectContent>
            </Select>
          </Card>
        </div>

        {/* Right Column: Cart & Actions */}
        <div className="space-y-6">
          <CartManager
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            taxRate={0.1}
            showTax={true}
          />

          {/* Order Actions */}
          {cartItems.length > 0 && selectedCustomer && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Order Actions</h3>

              <div className="space-y-3">
                <Button
                  onClick={handleSaveAsQuote}
                  disabled={isProcessing}
                  className="w-full h-12"
                  variant="outline"
                >
                  <Send className="h-5 w-5 mr-2" />
                  Save as Quote
                </Button>

                <Button
                  onClick={handleConfirmOrder}
                  disabled={isProcessing}
                  className="w-full h-12"
                  variant="default"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Confirm Order
                </Button>

                <Button
                  onClick={handleHoldForConfirmation}
                  disabled={isProcessing}
                  className="w-full h-12"
                  variant="secondary"
                >
                  <Clock className="h-5 w-5 mr-2" />
                  Hold for Confirmation
                </Button>
              </div>

              {isProcessing && (
                <p className="text-sm text-center text-muted-foreground mt-4">
                  Processing...
                </p>
              )}

              <Separator className="my-4" />

              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Quote:</strong> Create quote and email to customer</p>
                <p><strong>Confirm:</strong> Create order and generate invoice</p>
                <p><strong>Hold:</strong> Save as pending, await customer callback</p>
              </div>
            </Card>
          )}

          {/* Prompt to select customer */}
          {cartItems.length > 0 && !selectedCustomer && (
            <Card className="p-6 bg-yellow-50 border-yellow-200">
              <p className="text-sm text-yellow-800">
                Please select a customer to proceed with order actions
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
