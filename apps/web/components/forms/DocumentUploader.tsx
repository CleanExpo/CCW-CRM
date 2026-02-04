"use client";

/**
 * PHASE AI: Document Uploader Component
 *
 * Upload emails or PDFs to extract order data automatically.
 */

import { useState } from "react";
import { Upload, FileText, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

interface ParsedData {
  extracted_data: {
    customer?: {
      id: string | null;
      email: string;
      name: string | null;
    };
    products: Array<{
      product_id: string;
      sku: string;
      name: string;
      quantity: number;
      unit_price: number;
      confidence: number;
    }>;
    delivery_notes?: string;
    notes?: string;
  };
  confidence: number;
  unmatched_items: Array<{
    name: string;
    sku?: string;
    quantity: number;
  }>;
  validation_errors: string[];
}

interface DocumentUploaderProps {
  onParsed: (data: ParsedData) => void;
  onClose: () => void;
}

export function DocumentUploader({ onParsed, onClose }: DocumentUploaderProps) {
  const [documentType, setDocumentType] = useState<"email" | "pdf_quote">("email");
  const [emailText, setEmailText] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleParse = async () => {
    if (!emailText.trim()) {
      toast({
        title: "Error",
        description: "Please enter email content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("document_type", documentType);
      formData.append("content", emailText);
      if (senderEmail) {
        formData.append("sender_email", senderEmail);
      }

      const result = await apiClient.post<ParsedData>(
        "/api/ai/parse-document",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast({
        title: "Success",
        description: `Extracted ${result.extracted_data.products.length} products with ${Math.round(result.confidence * 100)}% confidence`,
      });

      onParsed(result);
    } catch (error: any) {
      toast({
        title: "Parsing Failed",
        description: error.message || "Could not parse document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Import from Email/Document</h3>
          <Badge variant="outline">AI-Powered</Badge>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Document Type</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={documentType === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocumentType("email")}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Order
              </Button>
              <Button
                type="button"
                variant={documentType === "pdf_quote" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocumentType("pdf_quote")}
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF Quote
              </Button>
            </div>
          </div>

          {documentType === "email" && (
            <div>
              <Label>Sender Email (Optional)</Label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used to automatically identify customer
              </p>
            </div>
          )}

          <div>
            <Label>Email/Document Content</Label>
            <Textarea
              placeholder="Paste email content here...&#10;&#10;Example:&#10;Hi, we need:&#10;- 50x SKU-001&#10;- 30x SKU-002&#10;Ship to Sydney warehouse."
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              className="mt-1 min-h-[200px] font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleParse}
              disabled={loading || !emailText.trim()}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {loading ? "Parsing..." : "Parse & Import"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            AI will extract customer, products, and quantities. Review before creating order.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
