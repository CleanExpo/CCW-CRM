"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(50, "SKU must be 50 characters or less"),
  name: z.string().min(1, "Name is required").max(255, "Name must be 255 characters or less"),
  description: z.string().optional(),
  category: z.enum([
    "heavy_machinery",
    "hand_tools",
    "power_tools",
    "safety_equipment",
    "building_materials",
    "electrical",
    "plumbing",
    "accessories",
  ], {
    required_error: "Please select a category",
  }),
  price: z.coerce.number().min(0, "Price must be 0 or greater"),
  cost: z.coerce.number().min(0, "Cost must be 0 or greater"),
  stock: z.coerce.number().int().min(0, "Stock must be 0 or greater"),
  warehouse_location: z.string().optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  warehouse_location: string | null;
  is_active: boolean;
}

interface ProductFormProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const categoryLabels = {
  heavy_machinery: "Heavy Machinery",
  hand_tools: "Hand Tools",
  power_tools: "Power Tools",
  safety_equipment: "Safety Equipment",
  building_materials: "Building Materials",
  electrical: "Electrical",
  plumbing: "Plumbing",
  accessories: "Accessories",
};

export function ProductForm({ product, open, onOpenChange, onSuccess }: ProductFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEdit = !!product;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      category: "power_tools",
      price: 0,
      cost: 0,
      stock: 0,
      warehouse_location: "",
      is_active: true,
    },
  });

  // Reset form when product changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          sku: product.sku,
          name: product.name,
          description: product.description || "",
          category: product.category as any,
          price: product.price,
          cost: product.cost,
          stock: product.stock,
          warehouse_location: product.warehouse_location || "",
          is_active: product.is_active,
        });
      } else {
        form.reset({
          sku: "",
          name: "",
          description: "",
          category: "power_tools",
          price: 0,
          cost: 0,
          stock: 0,
          warehouse_location: "",
          is_active: true,
        });
      }
    }
  }, [open, product, form]);

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      if (isEdit) {
        await apiClient.put(`/api/products/${product.id}`, values);
        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        await apiClient.post("/api/products", values);
        toast({
          title: "Success",
          description: "Product created successfully",
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEdit ? "update" : "create"} product`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Create Product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the product information below."
              : "Add a new product to your catalog."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU *</FormLabel>
                    <FormControl>
                      <Input placeholder="CCW-PT-001" {...field} disabled={isEdit} />
                    </FormControl>
                    {isEdit && (
                      <FormDescription>SKU cannot be changed after creation</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Makita Cordless Drill Driver 18V" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Product description..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (AUD) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost (AUD) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Quantity *</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="warehouse_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Bay A-09" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Inactive products won&apos;t appear in catalogs and orders
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
