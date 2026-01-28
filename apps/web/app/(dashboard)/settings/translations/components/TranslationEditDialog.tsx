"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Sparkles, Loader2 } from "lucide-react";

interface Language {
  code: string;
  name: string;
  native_name: string;
  is_rtl: boolean;
}

interface ProductTranslation {
  id: string;
  sku: string;
  name: string;
  category: string;
  translations: Record<string, any>;
}

interface TranslationEditDialogProps {
  product: ProductTranslation;
  languages: Language[];
  onSuccess: () => void;
}

const translationSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  short_description: z.string().max(500, "Max 500 characters").optional(),
  meta_title: z.string().max(60, "Max 60 characters").optional(),
  meta_description: z.string().max(160, "Max 160 characters").optional(),
  translation_status: z.enum(["pending", "ai_generated", "human_reviewed", "approved"]),
});

type TranslationFormData = z.infer<typeof translationSchema>;

export function TranslationEditDialog({ product, languages, onSuccess }: TranslationEditDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    languages.find((l) => l.code !== "en")?.code || "zh-CN"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<TranslationFormData>({
    resolver: zodResolver(translationSchema),
    defaultValues: {
      name: "",
      description: "",
      short_description: "",
      meta_title: "",
      meta_description: "",
      translation_status: "human_reviewed",
    },
  });

  async function loadTranslation(languageCode: string) {
    try {
      const translation = await apiClient.get<{
        name: string;
        description?: string;
        short_description?: string;
        meta_title?: string;
        meta_description?: string;
        translation_status: string;
      }>(`/api/translations/products/${product.id}/${languageCode}`);

      form.reset({
        name: translation.name,
        description: translation.description || "",
        short_description: translation.short_description || "",
        meta_title: translation.meta_title || "",
        meta_description: translation.meta_description || "",
        translation_status: translation.translation_status as any,
      });
    } catch (error) {
      // Translation doesn't exist yet
      form.reset({
        name: product.name, // Start with source name
        description: "",
        short_description: "",
        meta_title: "",
        meta_description: "",
        translation_status: "pending",
      });
    }
  }

  async function handleGenerateTranslation() {
    setIsGenerating(true);
    try {
      const result = await apiClient.post<{
        translation: {
          name: string;
          description?: string;
          short_description?: string;
          meta_title?: string;
          meta_description?: string;
        };
      }>(`/api/translations/products/${product.id}/translate/${selectedLanguage}`, {});

      form.reset({
        name: result.translation.name,
        description: result.translation.description || "",
        short_description: result.translation.short_description || "",
        meta_title: result.translation.meta_title || "",
        meta_description: result.translation.meta_description || "",
        translation_status: "ai_generated",
      });

      toast({
        title: "Translation Generated",
        description: "AI-powered translation has been generated. Review and save if correct.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate translation",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function onSubmit(data: TranslationFormData) {
    setIsLoading(true);
    try {
      await apiClient.put(`/api/translations/products/${product.id}/${selectedLanguage}`, data);

      toast({
        title: "Translation Saved",
        description: `Translation for ${product.name} in ${selectedLanguage} has been saved successfully`,
      });

      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save translation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleLanguageChange(languageCode: string) {
    setSelectedLanguage(languageCode);
    loadTranslation(languageCode);
  }

  function handleOpen(value: boolean) {
    setOpen(value);
    if (value) {
      loadTranslation(selectedLanguage);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Translation</DialogTitle>
          <DialogDescription>
            {product.name} ({product.sku})
          </DialogDescription>
        </DialogHeader>

        {/* Language Selector */}
        <div className="flex items-center gap-4 pb-4 border-b">
          <label className="text-sm font-medium">Target Language:</label>
          <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages
                .filter((l) => l.code !== "en")
                .map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.native_name}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {lang.code}
                    </Badge>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateTranslation}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Generate
              </>
            )}
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="content">
              <TabsList>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                {/* Product Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Translated product name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Short Description */}
                <FormField
                  control={form.control}
                  name="short_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief product description (max 500 characters)"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0} / 500 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Full Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Complete product description"
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="seo" className="space-y-4">
                {/* Meta Title */}
                <FormField
                  control={form.control}
                  name="meta_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta Title (SEO)</FormLabel>
                      <FormControl>
                        <Input placeholder="SEO-friendly page title" {...field} />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0} / 60 characters - Optimal: 50-60
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Meta Description */}
                <FormField
                  control={form.control}
                  name="meta_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta Description (SEO)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="SEO-friendly page description"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0} / 160 characters - Optimal: 150-160
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            {/* Translation Status */}
            <FormField
              control={form.control}
              name="translation_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Translation Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="ai_generated">AI Generated</SelectItem>
                      <SelectItem value="human_reviewed">Human Reviewed</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Mark as "Human Reviewed" after verifying the translation
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Translation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
