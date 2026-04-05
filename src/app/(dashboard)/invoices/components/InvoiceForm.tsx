"use client";

import { useState, useEffect, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { invoicesApi } from "@/lib/api/invoices";
import type { Invoice, CreateInvoiceItemRequest } from "@/types/invoices";
import { Plus, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
  email: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number | string;
}

// Validation schema
const formSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  invoice_date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string().optional(),
      description: z.string().min(1, "Description is required"),
      quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
      unit_price: z.coerce.number().min(0, "Price must be positive"),
      tax_rate: z.coerce.number().min(0).max(100).optional(),
      tax_amount: z.coerce.number().min(0).optional(),
    })
  ).min(1, "At least one line item is required"),
});

type FormData = z.infer<typeof formSchema>;

interface InvoiceFormProps {
  invoice?: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InvoiceForm({ invoice, open, onOpenChange, onSuccess }: InvoiceFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const { toast } = useToast();
  const isEdit = !!invoice;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: "",
      invoice_date: new Date().toISOString().split("T")[0],
      due_date: "",
      notes: "",
      items: [
        {
          product_id: "",
          description: "",
          quantity: 1,
          unit_price: 0,
          tax_rate: 10,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Load customers
  const loadCustomers = useCallback(async () => {
    try {
      const response = await apiClient.get<{ items: Customer[] }>(
        "/api/customers?page=1&page_size=100"
      );
      setCustomers(response.items || []);
    } catch (error) {
      console.error("Failed to load customers:", error);
    }
  }, []);

  // Load products
  const loadProducts = useCallback(async () => {
    try {
      const response = await apiClient.get<{ items: Product[] }>(
        "/api/products?page=1&page_size=100"
      );
      setProducts(response.items || []);
    } catch (error) {
      console.error("Failed to load products:", error);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadProducts();
    }
  }, [open, loadCustomers, loadProducts]);

  // Reset form when dialog opens/closes or invoice changes
  useEffect(() => {
    if (open && invoice) {
      // Edit mode - populate form with invoice data
      form.reset({
        customer_id: invoice.customer_id,
        invoice_date: invoice.invoice_date.split("T")[0], // Format for date input
        due_date: invoice.due_date.split("T")[0], // Format for date input
        notes: invoice.notes || "",
        items: invoice.items && invoice.items.length > 0
          ? invoice.items.map((item) => ({
              product_id: item.product_id || "",
              description: item.description,
              quantity: item.quantity,
              unit_price: typeof item.unit_price === "string" ? parseFloat(item.unit_price) : item.unit_price,
              tax_rate: item.tax_rate || 0,
              tax_amount: item.tax_amount || 0,
            }))
          : [
              {
                product_id: "",
                description: "",
                quantity: 1,
                unit_price: 0,
                tax_rate: 0,
                tax_amount: 0,
              },
            ],
      });
    } else if (open && !invoice) {
      // Create mode - reset to defaults
      form.reset({
        customer_id: "",
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: "",
        notes: "",
        items: [
          {
            product_id: "",
            description: "",
            quantity: 1,
            unit_price: 0,
            tax_rate: 10,
          },
        ],
      });
    }
  }, [open, invoice, form]);

  // Handle product selection for a line item
  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.description`, product.name);
      form.setValue(
        `items.${index}.unit_price`,
        typeof product.price === "string" ? parseFloat(product.price) : product.price
      );
    }
  };

  // Handle form submission
  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      const items: CreateInvoiceItemRequest[] = values.items.map((item) => ({
        product_id: item.product_id || "",
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        tax_amount: item.tax_amount,
      }));

      if (isEdit && invoice) {
        await invoicesApi.update(invoice.id, {
          customer_id: values.customer_id,
          invoice_date: values.invoice_date,
          due_date: values.due_date,
          notes: values.notes,
          items,
        });
        toast({
          title: "Success",
          description: "Invoice updated successfully",
        });
      } else {
        await invoicesApi.create({
          customer_id: values.customer_id,
          invoice_date: values.invoice_date,
          due_date: values.due_date,
          notes: values.notes,
          items,
        });
        toast({
          title: "Success",
          description: "Invoice created successfully",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Operation failed";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate totals
  const calculateTotals = () => {
    const items = form.watch("items");
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price);
    }, 0);

    const tax = items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price;
      const taxRate = item.tax_rate || 0;
      return sum + (itemSubtotal * (taxRate / 100));
    }, 0);

    const total = subtotal + tax;

    return { subtotal, tax, total };
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update invoice details and line items"
              : "Create a new invoice for a customer"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Customer Selection */}
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.company_name} ({customer.customer_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Invoice Date */}
              <FormField
                control={form.control}
                name="invoice_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date */}
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Internal notes about this invoice..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Line Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      product_id: "",
                      description: "",
                      quantity: 1,
                      unit_price: 0,
                      tax_rate: 0,
                      tax_amount: 0,
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-4 border rounded-lg">
                  {/* Product Select (Optional) */}
                  <div className="col-span-3">
                    <label className="text-sm font-medium">Product</label>
                    <Select
                      onValueChange={(value) => handleProductSelect(index, value)}
                      value={form.watch(`items.${index}.product_id`) || ""}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (Custom)</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Description *</FormLabel>
                          <FormControl>
                            <Input placeholder="Item description" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Qty *</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Price *</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="col-span-1 flex items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="mt-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Validation Error for Items */}
              {form.formState.errors.items?.root && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.items.root.message}
                </p>
              )}
            </div>

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Subtotal:</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Tax:</span>
                <span>${totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : isEdit ? "Update Invoice" : "Create Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
