'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';

interface AIProductCopyGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName?: string;
  productCategory?: string;
  onCopyGenerated: (generatedCopy: string, copyType: string) => void;
}

type CopyType = 'description' | 'features' | 'marketing' | 'technical';

interface AIProductCopyResponse {
  generated_copy: string;
}

const COPY_TYPES = [
  {
    value: 'description',
    label: 'Product Description',
    placeholder: 'Detailed product overview...',
  },
  { value: 'features', label: 'Feature List', placeholder: 'Key features and benefits...' },
  { value: 'marketing', label: 'Marketing Pitch', placeholder: 'Compelling sales copy...' },
  { value: 'technical', label: 'Technical Specs', placeholder: 'Technical specifications...' },
] as const;

/**
 * PHASE C: AI Product Copy Generator
 *
 * Generates compelling product descriptions, feature lists, and marketing copy
 * using AI. Helps users write better product content faster.
 *
 * @example
 * <AIProductCopyGenerator
 *   open={aiDialogOpen}
 *   onOpenChange={setAiDialogOpen}
 *   productName={form.watch("name")}
 *   productCategory={form.watch("category")}
 *   onCopyGenerated={(copy, type) => handleCopyInsert(copy, type)}
 * />
 */
export function AIProductCopyGenerator({
  open,
  onOpenChange,
  productName,
  productCategory,
  onCopyGenerated,
}: AIProductCopyGeneratorProps) {
  const { toast } = useToast();
  const [copyType, setCopyType] = useState<CopyType>('description');
  const [productInfo, setProductInfo] = useState('');
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedType = COPY_TYPES.find((t) => t.value === copyType);

  const handleGenerate = async () => {
    if (!productInfo.trim() && !productName) {
      toast({
        title: 'Information needed',
        description: 'Please provide product details or key information',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiClient.post<AIProductCopyResponse>(
        '/api/ai/generate/product-copy',
        {
          product_name: productName || 'Product',
          product_category: productCategory || 'general',
          copy_type: copyType,
          key_info: productInfo.trim(),
        }
      );

      setGeneratedCopy(response.generated_copy || '');
      toast({
        title: 'Copy Generated',
        description: `AI generated ${selectedType?.label.toLowerCase()}. Review and use as needed.`,
      });
    } catch (error: unknown) {
      console.error('Failed to generate copy:', error);
      toast({
        title: 'Generation Failed',
        description:
          error instanceof Error ? error.message : 'AI copy generation failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedCopy);
      setCopied(true);
      toast({
        title: 'Copied',
        description: 'Copy has been copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleUseGenerated = () => {
    if (generatedCopy) {
      onCopyGenerated(generatedCopy, copyType);
      onOpenChange(false);
      setGeneratedCopy('');
      setProductInfo('');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setGeneratedCopy('');
    setProductInfo('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary h-5 w-5" />
            Generate Product Copy with AI
          </DialogTitle>
          <DialogDescription>
            Provide key product information and AI will generate compelling marketing copy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Name Display */}
          {productName && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm font-medium">Product: {productName}</p>
              {productCategory && (
                <p className="text-muted-foreground text-sm">Category: {productCategory}</p>
              )}
            </div>
          )}

          {/* Copy Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="copyType">Copy Type</Label>
            <Select value={copyType} onValueChange={(value) => setCopyType(value as CopyType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select copy type" />
              </SelectTrigger>
              <SelectContent>
                {COPY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Information Input */}
          <div className="space-y-2">
            <Label htmlFor="productInfo">Key Information</Label>
            <Textarea
              id="productInfo"
              placeholder={`Example: Industrial-grade, 3000 PSI, includes 5 nozzles, 2-year warranty\n\nOr: Power tool for professional contractors, cordless, 20V battery, lightweight design`}
              className="min-h-[120px]"
              value={productInfo}
              onChange={(e) => setProductInfo(e.target.value)}
              disabled={isGenerating}
            />
            <p className="text-muted-foreground text-sm">
              List key features, specifications, or selling points
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || (!productInfo.trim() && !productName)}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate {selectedType?.label}
              </>
            )}
          </Button>

          {/* Generated Copy Display */}
          {generatedCopy && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Generated Copy</Label>
                <Button variant="ghost" size="sm" onClick={handleCopyToClipboard} disabled={copied}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-muted/50 rounded-lg border p-4">
                <p className="text-sm whitespace-pre-wrap">{generatedCopy}</p>
              </div>
            </div>
          )}

          {/* Tips Section */}
          <div className="bg-muted text-muted-foreground rounded-lg p-4 text-sm">
            <p className="mb-2 font-medium">💡 Tips for best results:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Include specific features, specifications, and benefits</li>
              <li>Mention target audience or use cases</li>
              <li>Add unique selling points or competitive advantages</li>
              <li>You can regenerate with different details for variations</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isGenerating}>
            Cancel
          </Button>
          {generatedCopy && <Button onClick={handleUseGenerated}>Use This Copy</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
