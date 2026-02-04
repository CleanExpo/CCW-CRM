"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Languages, Loader2 } from "lucide-react";

interface Language {
  code: string;
  name: string;
  native_name: string;
  is_rtl: boolean;
}

interface BulkTranslateDialogProps {
  languages: Language[];
  onSuccess: () => void;
}

export function BulkTranslateDialog({ languages, onSuccess }: BulkTranslateDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState("");

  function toggleLanguage(code: string) {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function handleBulkTranslate() {
    if (selectedLanguages.length === 0) {
      toast({
        title: "No Languages Selected",
        description: "Please select at least one target language",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // First get all products (or filtered products)
      const params = new URLSearchParams({
        page: "1",
        page_size: "1000", // Get all products (or adjust as needed)
      });

      if (productFilter) {
        params.append("search", productFilter);
      }

      const productsResponse = await apiClient.get<{
        data: Array<{ id: string }>;
      }>(`/api/translations/products?${params}`);

      const productIds = productsResponse.data.map((p) => p.id);

      if (productIds.length === 0) {
        toast({
          title: "No Products Found",
          description: "No products match your filter criteria",
          variant: "destructive",
        });
        return;
      }

      // Queue batch translation
      const result = await apiClient.post<{
        queued_count: number;
        message: string;
      }>("/api/translations/products/batch", {
        product_ids: productIds,
        target_languages: selectedLanguages,
        priority: 5,
      });

      toast({
        title: "Translations Queued",
        description: `${result.queued_count} translations queued for ${productIds.length} products in ${selectedLanguages.length} languages`,
      });

      setOpen(false);
      setSelectedLanguages([]);
      setProductFilter("");
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to queue translations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Languages className="h-4 w-4 mr-2" />
          Bulk Translate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Translate Products</DialogTitle>
          <DialogDescription>
            Queue AI-powered translation for multiple products. Translations will be generated in the
            background and marked for review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Filter */}
          <div className="space-y-2">
            <Label>Product Filter (Optional)</Label>
            <Input
              placeholder="Search by product name or SKU (leave empty for all products)"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to translate all products, or enter search terms to filter
            </p>
          </div>

          {/* Language Selection */}
          <div className="space-y-3">
            <Label>Target Languages</Label>
            <div className="grid grid-cols-2 gap-3">
              {languages
                .filter((lang) => lang.code !== "en") // Don't translate to English (source language)
                .map((lang) => (
                  <div key={lang.code} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${lang.code}`}
                      checked={selectedLanguages.includes(lang.code)}
                      onCheckedChange={() => toggleLanguage(lang.code)}
                    />
                    <label
                      htmlFor={`lang-${lang.code}`}
                      className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <span>{lang.native_name}</span>
                      <Badge variant="outline" className="text-xs font-mono">
                        {lang.code}
                      </Badge>
                      {lang.is_rtl && (
                        <Badge variant="secondary" className="text-xs">
                          RTL
                        </Badge>
                      )}
                    </label>
                  </div>
                ))}
            </div>
            {selectedLanguages.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedLanguages.length} language{selectedLanguages.length === 1 ? "" : "s"} selected
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setSelectedLanguages(languages.filter((l) => l.code !== "en").map((l) => l.code))
              }
            >
              Select All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedLanguages([])}>
              Clear Selection
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleBulkTranslate} disabled={isLoading || selectedLanguages.length === 0}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Queueing...
              </>
            ) : (
              "Queue Translations"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
