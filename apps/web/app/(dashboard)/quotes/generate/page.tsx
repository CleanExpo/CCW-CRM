"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, ArrowRight, Check } from "lucide-react";
import { generateQuote, type GenerateQuoteResponse } from "@/lib/api/ai-generate";
import { useToast } from "@/hooks/use-toast";

export default function GenerateQuotePage() {
  const [requirements, setRequirements] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<GenerateQuoteResponse | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!requirements.trim()) {
      toast({
        title: "Requirements needed",
        description: "Please enter quote requirements",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await generateQuote({
        requirements: requirements.trim(),
      });

      if ("error" in response) {
        throw new Error((response as any).error);
      }

      setGeneratedQuote(response);
      toast({
        title: "Quote generated",
        description: `Generated quote ${response.quote_number} with ${response.items.length} items`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate quote",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          AI Quote Generator
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate quotes from natural language descriptions
        </p>
      </div>

      {/* Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quote Requirements</CardTitle>
          <CardDescription>
            Describe what the customer needs in plain English
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Example: Quote for 5 drilling machines for a mining company, need heavy-duty equipment with safety features..."
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={6}
            disabled={isGenerating}
            className="resize-none"
          />
          <div className="flex items-center gap-4">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !requirements.trim()}
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Quote...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Quote
                </>
              )}
            </Button>
            {generatedQuote && (
              <Button
                variant="outline"
                onClick={() => setRequirements("")}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Quote Preview */}
      {generatedQuote && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <CardTitle>Generated Quote: {generatedQuote.quote_number}</CardTitle>
              </div>
              <Button
                onClick={() => {
                  // In a real app, would navigate to quote creation form with pre-filled data
                  toast({
                    title: "Feature in progress",
                    description: "Quote saving functionality to be implemented",
                  });
                }}
              >
                Save Quote
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            <CardDescription>
              Review and edit before saving to the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Info */}
            {generatedQuote.customer.company_name && (
              <div>
                <h3 className="font-semibold mb-2">Customer</h3>
                <p className="text-sm">
                  {generatedQuote.customer.company_name}
                  {generatedQuote.customer.contact_name && (
                    <> - {generatedQuote.customer.contact_name}</>
                  )}
                </p>
              </div>
            )}

            {/* Items */}
            <div>
              <h3 className="font-semibold mb-2">Items ({generatedQuote.items.length})</h3>
              <div className="space-y-2">
                {generatedQuote.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-background rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.sku} | Category: {item.category}
                      </p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} x ${item.unit_price.toFixed(2)}
                      </p>
                      <p className="font-medium">${item.line_total.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="border-t pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${generatedQuote.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({(generatedQuote.tax_rate * 100).toFixed(0)}%)
                  </span>
                  <span>${generatedQuote.tax.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>${generatedQuote.total.toFixed(2)} {generatedQuote.currency}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            {generatedQuote.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm whitespace-pre-wrap">{generatedQuote.description}</p>
              </div>
            )}

            {/* Notes */}
            {generatedQuote.notes && (
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{generatedQuote.notes}</p>
              </div>
            )}

            {/* Validation Warnings */}
            {generatedQuote.validation_errors.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
                  Review Required
                </h3>
                <ul className="text-sm text-yellow-700 dark:text-yellow-500 list-disc list-inside space-y-1">
                  {generatedQuote.validation_errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Example Prompts */}
      {!generatedQuote && (
        <Card>
          <CardHeader>
            <CardTitle>Example Prompts</CardTitle>
            <CardDescription>Try these examples to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {[
                "Quote for 5 drilling machines for mining company",
                "Need 10 safety helmets and 20 pairs of gloves for construction site",
                "Quote for power tools: 3 electric drills, 2 angle grinders, 1 circular saw",
                "Heavy machinery for warehouse: 2 forklifts and 1 pallet jack",
              ].map((example, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="justify-start text-left h-auto py-3"
                  onClick={() => setRequirements(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
