"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Copy } from "lucide-react";
import { generateEmail, type GenerateEmailRequest } from "@/lib/api/ai-generate";
import { useToast } from "@/hooks/use-toast";

interface EmailComposerProps {
  customerId?: string;
  quoteId?: string;
  orderId?: string;
}

export function EmailComposer({ customerId, quoteId, orderId }: EmailComposerProps) {
  const [emailType, setEmailType] = useState<string>("custom");
  const [tone, setTone] = useState<string>("formal");
  const [requirements, setRequirements] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<any>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (emailType === "custom" && !requirements.trim()) {
      toast({
        title: "Requirements needed",
        description: "Please describe the email purpose",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const request: GenerateEmailRequest = {
        email_type: emailType as any,
        context: {
          customer_id: customerId,
          quote_id: quoteId,
          order_id: orderId,
          purpose: requirements,
        },
        requirements: requirements || undefined,
        tone: tone as any,
      };

      const response = await generateEmail(request);

      if ("error" in response) {
        throw new Error((response as any).error);
      }

      setGeneratedEmail(response);
      toast({
        title: "Email generated",
        description: "Your email draft is ready",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate email",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Email content copied to clipboard",
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Email Generator</CardTitle>
          <CardDescription>Generate professional customer emails with AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label>Email Type</Label>
              <Select value={emailType} onValueChange={setEmailType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Email</SelectItem>
                  {quoteId && <SelectItem value="quote_follow_up">Quote Follow-up</SelectItem>}
                  {orderId && <SelectItem value="order_confirmation">Order Confirmation</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {emailType === "custom" && (
              <div>
                <Label>Email Purpose</Label>
                <Textarea
                  placeholder="Describe the email purpose..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Email
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {generatedEmail && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Email</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${generatedEmail.subject}\n\n${generatedEmail.body}`)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>To</Label>
              <Input value={generatedEmail.to} readOnly />
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={generatedEmail.subject} readOnly />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={generatedEmail.body}
                rows={12}
                readOnly
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
