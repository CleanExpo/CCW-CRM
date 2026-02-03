"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

interface AIQuoteGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  onQuoteGenerated: (quoteData: any) => void;
}

/**
 * PHASE C: AI Quote Assistant
 *
 * Generates complete quote suggestions from natural language requirements.
 * Uses existing /api/ai/generate/quote endpoint.
 *
 * @example
 * <AIQuoteGenerator
 *   open={aiDialogOpen}
 *   onOpenChange={setAiDialogOpen}
 *   customerId={selectedCustomerId}
 *   onQuoteGenerated={(data) => prefillForm(data)}
 * />
 */
export function AIQuoteGenerator({
  open,
  onOpenChange,
  customerId,
  onQuoteGenerated,
}: AIQuoteGeneratorProps) {
  const { toast } = useToast();
  const [requirements, setRequirements] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!requirements.trim()) {
      toast({
        title: "Requirements needed",
        description: "Please describe what the customer needs",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiClient.post("/api/ai/generate/quote", {
        requirements: requirements.trim(),
        customer_id: customerId || null,
      });

      toast({
        title: "Quote Generated",
        description: "AI has suggested products and pricing. Review and adjust as needed.",
      });

      onQuoteGenerated(response);
      onOpenChange(false);
      setRequirements(""); // Clear for next use
    } catch (error: any) {
      console.error("Failed to generate quote:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "AI quote generation failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setRequirements("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Quote with AI
          </DialogTitle>
          <DialogDescription>
            Describe what the customer needs in natural language. AI will suggest products,
            quantities, and pricing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="requirements">Customer Requirements</Label>
            <Textarea
              id="requirements"
              placeholder="Example: 3 commercial pressure washers + accessories for car wash business&#10;&#10;Or: Customer needs safety equipment for construction site - 20 workers"
              className="min-h-[150px]"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">💡 Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Be specific about quantities and product types</li>
              <li>Mention the customer's business type if relevant</li>
              <li>Include any special requirements or constraints</li>
              <li>AI will search products and suggest competitive pricing</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !requirements.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Quote
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
