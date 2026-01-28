"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api/client";
import { Loader2, CreditCard, DollarSign, Banknote, Building2 } from "lucide-react";

// Form validation schema
const transactionSchema = z.object({
  amount: z.string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be greater than 0",
    }),
  payment_method: z.enum(["eftpos", "amex", "cash", "bank_transfer"], {
    required_error: "Please select a payment method",
  }),
  sales_staff_id: z.string().min(1, "Please select sales staff"),
  terminal_id: z.string().min(1, "Terminal not configured"),
  customer_id: z.string().optional(),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface SalesStaff {
  id: string;
  staff_code: string;
  full_name: string;
  primary_location_code: string;
}

interface POSTerminal {
  id: string;
  terminal_id: string;
  location_code: string;
  terminal_type: string;
  is_active: boolean;
}

interface Transaction {
  id: string;
  transaction_number: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  location_code: string;
  resolved_location_code: string;
  created_at: string;
}

export default function POSTerminalPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [salesStaff, setSalesStaff] = useState<SalesStaff[]>([]);
  const [terminals, setTerminals] = useState<POSTerminal[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<POSTerminal | null>(null);

  // Initialize form
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: "",
      payment_method: "eftpos",
      sales_staff_id: "",
      terminal_id: "",
      notes: "",
    },
  });

  // Load initial data
  useEffect(() => {
    loadSalesStaff();
    loadTerminals();
    loadRecentTransactions();
  }, []);

  // Update terminal when selected
  useEffect(() => {
    const terminalId = form.watch("terminal_id");
    if (terminalId) {
      const terminal = terminals.find((t) => t.id === terminalId);
      setSelectedTerminal(terminal || null);
    }
  }, [form.watch("terminal_id"), terminals]);

  async function loadSalesStaff() {
    try {
      const response = await apiClient.get<{ data: SalesStaff[] }>("/api/pos/staff");
      setSalesStaff(response.data || []);
    } catch (error) {
      console.error("Failed to load sales staff:", error);
    }
  }

  async function loadTerminals() {
    try {
      const response = await apiClient.get<{ data: POSTerminal[] }>("/api/pos/terminals");
      const activeTerminals = (response.data || []).filter((t) => t.is_active);
      setTerminals(activeTerminals);

      // Auto-select first terminal
      if (activeTerminals.length > 0) {
        form.setValue("terminal_id", activeTerminals[0].id);
      }
    } catch (error) {
      console.error("Failed to load terminals:", error);
    }
  }

  async function loadRecentTransactions() {
    try {
      const response = await apiClient.get<{ data: Transaction[] }>(
        "/api/pos/transactions?limit=5"
      );
      setRecentTransactions(response.data || []);
    } catch (error) {
      console.error("Failed to load recent transactions:", error);
    }
  }

  async function onSubmit(values: TransactionFormData) {
    setIsProcessing(true);

    try {
      const payload = {
        terminal_id: values.terminal_id,
        sales_staff_id: values.sales_staff_id,
        amount: parseFloat(values.amount),
        payment_method: values.payment_method,
        notes: values.notes,
      };

      const response = await apiClient.post<Transaction>(
        "/api/pos/transactions",
        payload
      );

      if (response.payment_status === "captured") {
        toast({
          title: "Payment Successful",
          description: `Transaction ${response.transaction_number} completed. Amount: $${response.amount.toFixed(2)}`,
        });

        // Reset form
        form.reset({
          amount: "",
          payment_method: "eftpos",
          sales_staff_id: values.sales_staff_id, // Keep same staff
          terminal_id: values.terminal_id, // Keep same terminal
          notes: "",
        });

        // Reload recent transactions
        loadRecentTransactions();
      } else if (response.payment_status === "pending") {
        toast({
          title: "Payment Pending",
          description: `Transaction ${response.transaction_number} is pending reconciliation.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Payment Failed",
          description: "The payment was declined. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  // Get payment method icon
  function getPaymentIcon(method: string) {
    switch (method) {
      case "eftpos":
        return <CreditCard className="h-4 w-4" />;
      case "amex":
        return <CreditCard className="h-4 w-4" />;
      case "cash":
        return <Banknote className="h-4 w-4" />;
      case "bank_transfer":
        return <Building2 className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  }

  // Format payment method label
  function formatPaymentMethod(method: string) {
    const labels: Record<string, string> = {
      eftpos: "EFTPOS",
      amex: "AMEX",
      cash: "Cash",
      bank_transfer: "Bank Transfer",
    };
    return labels[method] || method;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">POS Terminal</h1>
          <p className="text-muted-foreground">Process walk-in sales and payments</p>
        </div>

        {selectedTerminal && (
          <Badge variant="outline" className="text-base">
            <Building2 className="mr-2 h-4 w-4" />
            {selectedTerminal.location_code} - {selectedTerminal.terminal_id}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>New Transaction</CardTitle>
            <CardDescription>
              Enter transaction details and process payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Terminal Selection */}
                <FormField
                  control={form.control}
                  name="terminal_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terminal</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select terminal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {terminals.map((terminal) => (
                            <SelectItem key={terminal.id} value={terminal.id}>
                              {terminal.terminal_id} ({terminal.location_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Sales Staff Selection */}
                <FormField
                  control={form.control}
                  name="sales_staff_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Staff</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sales staff" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {salesStaff.map((staff) => (
                            <SelectItem key={staff.id} value={staff.id}>
                              {staff.full_name} ({staff.staff_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Location routing: Terminal location or staff home location
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Amount */}
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (AUD)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-10 text-2xl font-bold"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Method */}
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="eftpos">
                            <div className="flex items-center">
                              <CreditCard className="mr-2 h-4 w-4" />
                              EFTPOS
                            </div>
                          </SelectItem>
                          <SelectItem value="amex">
                            <div className="flex items-center">
                              <CreditCard className="mr-2 h-4 w-4" />
                              AMEX
                            </div>
                          </SelectItem>
                          <SelectItem value="cash">
                            <div className="flex items-center">
                              <Banknote className="mr-2 h-4 w-4" />
                              Cash
                            </div>
                          </SelectItem>
                          <SelectItem value="bank_transfer">
                            <div className="flex items-center">
                              <Building2 className="mr-2 h-4 w-4" />
                              Bank Transfer
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {field.value === "eftpos" && "95% approval rate, 2s processing"}
                        {field.value === "amex" && "90% approval rate, 1s processing"}
                        {field.value === "cash" && "Immediate capture"}
                        {field.value === "bank_transfer" && "Pending reconciliation"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Transaction notes"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      {getPaymentIcon(form.watch("payment_method"))}
                      <span className="ml-2">Process Payment</span>
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Last 5 transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent transactions
                </p>
              ) : (
                recentTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-start justify-between border-b pb-3 last:border-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{txn.transaction_number}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {getPaymentIcon(txn.payment_method)}
                        <span>{formatPaymentMethod(txn.payment_method)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-bold">
                        ${txn.amount.toFixed(2)}
                      </p>
                      <Badge
                        variant={
                          txn.payment_status === "captured"
                            ? "default"
                            : txn.payment_status === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {txn.payment_status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
