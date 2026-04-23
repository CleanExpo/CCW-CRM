'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, ArrowRight, Check } from 'lucide-react';
import { generateQuote, type GenerateQuoteResponse } from '@/lib/api/ai-generate';
import { useToast } from '@/hooks/use-toast';

export default function GenerateQuotePage() {
  const [requirements, setRequirements] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<GenerateQuoteResponse | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!requirements.trim()) {
      toast({
        title: 'Requirements needed',
        description: 'Please enter quote requirements',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await generateQuote({
        requirements: requirements.trim(),
      });

      setGeneratedQuote(response);
      toast({
        title: 'Quote generated',
        description: `Generated quote ${response.quote_number} with ${response.items.length} items`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate quote',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Sparkles className="text-primary h-8 w-8" />
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
          <CardDescription>Describe what the customer needs in plain English</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Example: Quote for 2 TruckMount extractors and carpet cleaning accessories for a commercial cleaning company in Brisbane..."
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Quote...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Quote
                </>
              )}
            </Button>
            {generatedQuote && (
              <Button variant="outline" onClick={() => setRequirements('')}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Quote Preview */}
      {generatedQuote && (
        <Card className="from-primary/5 to-primary/10 bg-gradient-to-br">
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
                    title: 'Feature in progress',
                    description: 'Quote saving functionality to be implemented',
                  });
                }}
              >
                Save Quote
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Review and edit before saving to the system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Info */}
            {generatedQuote.customer.company_name && (
              <div>
                <h3 className="mb-2 font-semibold">Customer</h3>
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
              <h3 className="mb-2 font-semibold">Items ({generatedQuote.items.length})</h3>
              <div className="space-y-2">
                {generatedQuote.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-background flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-muted-foreground text-sm">
                        SKU: {item.sku} | Category: {item.category}
                      </p>
                      {item.description && (
                        <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-muted-foreground text-sm">
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
                <div className="flex items-center justify-between border-t pt-2 text-lg font-bold">
                  <span>Total</span>
                  <span>
                    ${generatedQuote.total.toFixed(2)} {generatedQuote.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {generatedQuote.description && (
              <div>
                <h3 className="mb-2 font-semibold">Description</h3>
                <p className="text-sm whitespace-pre-wrap">{generatedQuote.description}</p>
              </div>
            )}

            {/* Notes */}
            {generatedQuote.notes && (
              <div>
                <h3 className="mb-2 font-semibold">Notes</h3>
                <p className="text-muted-foreground text-sm">{generatedQuote.notes}</p>
              </div>
            )}

            {/* Validation Warnings */}
            {generatedQuote.validation_errors.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/20">
                <h3 className="mb-2 font-semibold text-yellow-800 dark:text-yellow-400">
                  Review Required
                </h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-yellow-700 dark:text-yellow-500">
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
                'Quote for 2 TruckMount carpet cleaning machines for a commercial cleaning company',
                'Need 3 portable extractors and 5 litres of pre-spray solution for a carpet cleaner startup',
                'Quote for water damage restoration kit: 4 air movers, 2 dehumidifiers, moisture meter',
                'Hard floor care package: 1 scrubbing machine and 10L of neutral floor cleaner',
              ].map((example, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="h-auto justify-start py-3 text-left"
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
