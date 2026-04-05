"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditCard, Banknote, Building2, Loader2, CheckCircle2 } from "lucide-react";
import { PaymentMethod, SalesStaff, CartItem } from "../types";

interface PaymentPanelProps {
  total: number;
  items: CartItem[];
  salesStaff: SalesStaff[];
  selectedStaffId: string | null;
  onSelectStaff: (staffId: string) => void;
  onProcessPayment: (method: PaymentMethod) => Promise<void>;
  isProcessing: boolean;
}

const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "eftpos", label: "EFTPOS", icon: <CreditCard className="h-6 w-6" /> },
  { value: "amex", label: "AMEX", icon: <CreditCard className="h-6 w-6" /> },
  { value: "cash", label: "Cash", icon: <Banknote className="h-6 w-6" /> },
  { value: "bank_transfer", label: "Bank Transfer", icon: <Building2 className="h-6 w-6" /> },
];

export function PaymentPanel({
  total,
  items,
  salesStaff,
  selectedStaffId,
  onSelectStaff,
  onProcessPayment,
  isProcessing,
}: PaymentPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  const handlePaymentClick = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setConfirmOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (selectedMethod) {
      setConfirmOpen(false);
      await onProcessPayment(selectedMethod);
    }
  };

  const canProcess = items.length > 0 && total > 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sales Staff Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Sales Staff</label>
          <Select value={selectedStaffId || ""} onValueChange={onSelectStaff}>
            <SelectTrigger>
              <SelectValue placeholder="Select staff member" />
            </SelectTrigger>
            <SelectContent>
              {salesStaff.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.full_name} ({staff.staff_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Total Display */}
        <div className="p-4 bg-primary/5 rounded-lg text-center">
          <div className="text-sm text-muted-foreground">Amount Due</div>
          <div className="text-3xl font-bold text-primary">{formatCurrency(total)}</div>
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-2 gap-3">
          {paymentMethods.map((method) => (
            <Button
              key={method.value}
              variant="outline"
              className="h-20 flex flex-col gap-2"
              disabled={!canProcess || isProcessing}
              onClick={() => handlePaymentClick(method.value)}
            >
              {method.icon}
              <span className="text-sm">{method.label}</span>
            </Button>
          ))}
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing payment...</span>
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-primary">
                    {formatCurrency(total)}
                  </div>
                  <div className="text-muted-foreground mt-2">
                    via {selectedMethod?.toUpperCase()}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span>Items:</span>
                    <span>{items.length}</span>
                  </div>
                  {selectedStaffId && (
                    <div className="flex justify-between">
                      <span>Staff:</span>
                      <span>
                        {salesStaff.find((s) => s.id === selectedStaffId)?.full_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPayment}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
