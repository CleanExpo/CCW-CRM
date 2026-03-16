"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Info, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  generateQuote,
  type QuoteGenerationResult,
  type ProductMatch,
} from "@/lib/api/ai-quotes";
import { apiClient } from "@/lib/api/client";

interface AIQuoteBuilderProps {
  onQuoteCreated?: (quoteId: string) => void;
}

const PROMPT_EXAMPLES = [
  {
    title: "Simple Quote",
    prompt: "Create a quote for ABC Corp with 50 hard hats at $25 each",
    icon: "📦",
  },
  {
    title: "Multiple Items",
    prompt: "Quote for John Smith: 5 power drills, 10 safety vests, and 2 ladders",
    icon: "🛠️",
  },
  {
    title: "Emergency Order",
    prompt: "Emergency shipment of 100 steel beams to Sydney for Smith Construction",
    icon: "🚨",
  },
  {
    title: "Bulk Order",
    prompt: "Bulk order: 200 safety helmets, 150 gloves, 100 goggles for site project",
    icon: "🏗️",
  },
];

function ConfidenceBadge({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const variant =
    percentage >= 80 ? "default" : percentage >= 60 ? "secondary" : "destructive";

  return (
    <Badge variant={variant} className="font-mono">
      {percentage}%
    </Badge>
  );
}

export function AIQuoteBuilder({ onQuoteCreated }: AIQuoteBuilderProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<QuoteGenerationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1: Prompt Input
  // Step 2: Review AI-Generated Data
  // Step 3: Save Quote
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleGenerate = async () => {
    if (!prompt || prompt.length < 10) {
      toast({
        title: "Invalid Prompt",
        description: "Please enter at least 10 characters describing your quote",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const data = await generateQuote(prompt);
      setResult(data);
      setStep(2);

      toast({
        title: "Quote Generated",
        description: "Review the AI-parsed data and make any adjustments before saving",
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveQuote = async () => {
    if (!result) return;

    setIsSaving(true);
    try {
      // Create the quote using the standard quotes API
      const quoteData = {
        customer_id: result.customer.customer_id,
        customer_name: result.customer.company_name,
        contact_name: result.customer.contact_name,
        email: result.customer.email,
        line_items: result.line_items.map((item: ProductMatch) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price),
        })),
        notes: result.notes || `AI-generated quote (confidence: ${Math.round(result.confidence_score * 100)}%)`,
        discount_percentage: result.discount_percentage,
      };

      const response = await apiClient.post<{ id: string; quote_number: string }>("/api/quotes", quoteData);

      toast({
        title: "Quote Created",
        description: `Quote ${response.quote_number} created successfully`,
      });

      if (onQuoteCreated) {
        onQuoteCreated(response.id);
      } else {
        router.push("/dashboard/quotes" as any);
        router.refresh();
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPrompt("");
    setResult(null);
    setStep(1);
  };

  const useExample = (example: string) => {
    setPrompt(example);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Quote Generator</h1>
          <p className="text-muted-foreground">
            Create quotes from natural language using Claude AI
          </p>
        </div>
      </div>

      {/* Step 1: Prompt Input */}
      {step === 1 && (
        <>
          {/* Prompt Examples */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Try These Examples</CardTitle>
              <CardDescription>Click an example to use it as your prompt</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {PROMPT_EXAMPLES.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto justify-start text-left"
                    onClick={() => useExample(example.prompt)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{example.icon}</span>
                      <div>
                        <div className="font-semibold">{example.title}</div>
                        <div className="text-xs text-muted-foreground">{example.prompt}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Prompt Input */}
          <Card>
            <CardHeader>
              <CardTitle>Describe Your Quote</CardTitle>
              <CardDescription>
                Describe the quote in natural language. Include customer name, products, and
                quantities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Quote Requirements</Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g., Create a quote for John Smith with 5 power drills and 10 safety helmets"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {prompt.length}/500 characters (minimum 10)
                </p>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || prompt.length < 10}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Quote...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Quote with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 2: Review AI-Generated Data */}
      {step === 2 && result && (
        <>
          {/* Overall Confidence */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>AI Confidence Score</AlertTitle>
            <AlertDescription className="flex items-center gap-2">
              Overall confidence: <ConfidenceBadge score={result.confidence_score} />
              {result.confidence_score < 0.8 && (
                <span className="text-yellow-600">
                  Review carefully - some matches may need adjustment
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Customer Match */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Customer</CardTitle>
                <ConfidenceBadge score={result.customer.confidence} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium">Company:</span>{" "}
                <span className="text-sm">{result.customer.company_name}</span>
              </div>
              {result.customer.contact_name && (
                <div>
                  <span className="text-sm font-medium">Contact:</span>{" "}
                  <span className="text-sm">{result.customer.contact_name}</span>
                </div>
              )}
              {result.customer.email && (
                <div>
                  <span className="text-sm font-medium">Email:</span>{" "}
                  <span className="text-sm">{result.customer.email}</span>
                </div>
              )}
              {result.customer.is_new_customer && (
                <Badge variant="secondary">New Customer</Badge>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line Items ({result.line_items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.line_items.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          <ConfidenceBadge score={item.confidence} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          SKU: {item.sku} | Category: {item.category}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${item.line_total}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.quantity} × ${item.unit_price}
                        </div>
                      </div>
                    </div>

                    {item.alternatives && item.alternatives.length > 0 && (
                      <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle className="text-sm">Alternative Products</AlertTitle>
                        <AlertDescription className="text-xs">
                          {item.alternatives.map((alt, idx) => (
                            <div key={idx}>
                              {alt.name} (SKU: {alt.sku}) - ${alt.price}
                            </div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}

                    {index < result.line_items.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-medium">${result.subtotal}</span>
                </div>
                {result.discount_percentage > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({result.discount_percentage}%):</span>
                    <span>-${result.discount_amount}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${result.total}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Valid until: {new Date(result.valid_until).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {result.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Suggestions</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {result.suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleReset} variant="outline" className="flex-1">
              Start Over
            </Button>
            <Button
              onClick={handleSaveQuote}
              disabled={isSaving}
              className="flex-1"
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Save Quote
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
