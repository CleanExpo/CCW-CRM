"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentMethodFormProps {
  onSubmit: (paymentMethodId: string) => Promise<void>;
  onCancel?: () => void;
}

export function PaymentMethodForm({ onSubmit, onCancel }: PaymentMethodFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Simplified version for MVP - in production, use Stripe Elements
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      // TODO: In production, use Stripe.js to create payment method
      // const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      // const { error, paymentMethod } = await stripe.createPaymentMethod({
      //   type: 'card',
      //   card: elements.getElement(CardElement),
      //   billing_details: { name }
      // });
      //
      // if (error) {
      //   throw new Error(error.message);
      // }
      //
      // await onSubmit(paymentMethod.id);

      // For MVP, simulate payment method creation
      const mockPaymentMethodId = `pm_${Date.now()}`;
      await onSubmit(mockPaymentMethodId);

      toast({
        title: "Payment Method Added",
        description: "Your payment method has been securely saved",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add payment method",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Add Payment Method
        </CardTitle>
        <CardDescription>
          Your payment information is securely processed by Stripe
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Note: In production, replace this with Stripe CardElement */}
          <div className="rounded-md border border-input bg-muted p-4">
            <p className="text-sm text-muted-foreground mb-4">
              🔒 Stripe Elements integration placeholder
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    placeholder="MM/YY"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    placeholder="123"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Cardholder Name</Label>
                <Input
                  id="name"
                  placeholder="John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            By providing your payment information, you authorize CCW ERP to charge your payment
            method for the subscription amount each billing period.
          </p>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Payment Method
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
