'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
// PHASE C: AI Product Copy Generator
import { AIProductCopyGenerator } from '@/components/ai/AIProductCopyGenerator';

const productCategories = [
  'heavy_machinery',
  'hand_tools',
  'power_tools',
  'safety_equipment',
  'building_materials',
  'electrical',
  'plumbing',
  'accessories',
] as const;

const formSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50, 'SKU must be 50 characters or less'),
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  description: z.string().optional(),
  category: z.enum(productCategories, {
    required_error: 'Please select a category',
  }),
  price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  cost: z.coerce.number().min(0, 'Cost must be 0 or greater'),
  stock: z.coerce.number().int().min(0, 'Stock must be 0 or greater'),
  warehouse_location: z.string().optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;
type ProductCategory = FormData['category'];

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  category: ProductCategory;
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

const categoryLabels: Record<ProductCategory, string> = {
  heavy_machinery: 'Heavy Machinery',
  hand_tools: 'Hand Tools',
  power_tools: 'Power Tools',
  safety_equipment: 'Safety Equipment',
  building_materials: 'Building Materials',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  accessories: 'Accessories',
};

export function ProductForm({ product, open, onOpenChange, onSuccess }: ProductFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false); // PHASE C: AI dialog state
  const isEdit = !!product;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      category: 'power_tools',
      price: 0,
      cost: 0,
      stock: 0,
      warehouse_location: '',
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
          description: product.description || '',
          category: product.category,
          price: product.price,
          cost: product.cost,
          stock: product.stock,
          warehouse_location: product.warehouse_location || '',
          is_active: product.is_active,
        });
      } else {
        form.reset({
          sku: '',
          name: '',
          description: '',
          category: 'power_tools',
          price: 0,
          cost: 0,
          stock: 0,
          warehouse_location: '',
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
          title: 'Success',
          description: 'Product updated successfully',
        });
      } else {
        await apiClient.post('/api/products', values);
        toast({
          title: 'Success',
          description: 'Product created successfully',
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to ${isEdit ? 'update' : 'create'} product`;
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // PHASE C: Handler for AI-generated product copy
  const handleCopyGenerated = (generatedCopy: string, copyType: string) => {
    // Insert the generated copy into the description field
    form.setValue('description', generatedCopy);
    toast({
      title: 'Copy Inserted',
      description: `AI-generated ${copyType} has been added to the description field.`,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Product' : 'Create Product'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update the product information below.'
                : 'Add a new product to your catalog.'}
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
                    <div className="flex items-center justify-between">
                      <FormLabel>Description</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAiDialogOpen(true)}
                        className="h-auto p-1 text-xs"
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        Generate with AI
                      </Button>
                    </div>
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
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
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
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
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
                  <FormItem>
                    <div
                      className={cn(
                        'flex flex-col gap-4 rounded-xl border-2 p-4 shadow-sm transition-colors sm:flex-row sm:items-center sm:justify-between',
                        field.value
                          ? 'border-emerald-300/80 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/40'
                          : 'border-amber-300/80 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/40',
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                        <Badge
                          variant={field.value ? 'success' : 'secondary'}
                          className="h-7 shrink-0 px-3 text-xs font-semibold uppercase tracking-wide"
                        >
                          {field.value ? 'Active' : 'Inactive'}
                        </Badge>
                        <div className="min-w-0 space-y-1">
                          <FormLabel className="text-base font-semibold">Product status</FormLabel>
                          <FormDescription
                            className={cn(
                              field.value
                                ? 'text-emerald-950 dark:text-emerald-100/90'
                                : 'text-amber-950 dark:text-amber-100/90',
                            )}
                          >
                            {field.value
                              ? 'Listed in catalog, POS, and available on orders.'
                              : 'Inactive SKUs are hidden from ordering until you activate them again.'}
                          </FormDescription>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-black/5 pt-3 dark:border-white/10 sm:border-t-0 sm:pt-0">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            field.value
                              ? 'text-emerald-800 dark:text-emerald-200'
                              : 'text-amber-800 dark:text-amber-200',
                          )}
                        >
                          {field.value ? 'Sellable' : 'Not sellable'}
                        </span>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label={
                              field.value
                                ? 'Product is active; switch to deactivate'
                                : 'Product is inactive; switch to activate'
                            }
                            className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-zinc-400 dark:data-[state=unchecked]:bg-zinc-600"
                          />
                        </FormControl>
                      </div>
                    </div>
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
                  {isLoading ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* PHASE C: AI Product Copy Generator */}
      <AIProductCopyGenerator
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        productName={form.watch('name')}
        productCategory={form.watch('category')}
        onCopyGenerated={handleCopyGenerated}
      />
    </>
  );
}
