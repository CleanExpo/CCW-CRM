"use client";

import * as React from "react";
import { useState } from "react";
import Image, { type ImageLoaderProps } from "next/image";
import { Button } from "@/components/ui/button";
import { BentoCard, BentoCardHeader, BentoCardTitle, BentoCardDescription, BentoCardContent } from "@/components/ui/bento-grid";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, ImageIcon, FileText, Download, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================
   AI MEDIA GENERATOR - Image & Copy Generation
   Linear-style component for AI-powered marketing assets
   ============================================ */

export interface MediaGeneratorProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "gradient";
  span?: 1 | 2 | 3 | 4;
}

interface GeneratedAsset {
  type: "image" | "copy";
  content: string;
  timestamp: Date;
  prompt: string;
}

const rawImageLoader = ({ src }: ImageLoaderProps) => src;

export function MediaGenerator({ className, variant = "glass", span = 2, ...props }: MediaGeneratorProps) {
  const [activeTab, setActiveTab] = useState<"image" | "copy">("image");
  const [imagePrompt, setImagePrompt] = useState("");
  const [copyPrompt, setCopyPrompt] = useState("");
  const [copyType, setCopyType] = useState<"email" | "social" | "ad">("email");
  const [copyTone, setCopyTone] = useState<"professional" | "casual" | "persuasive">("professional");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;

    setGeneratingImage(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      setGeneratedImage(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateCopy = async () => {
    if (!copyPrompt.trim()) return;

    setGeneratingCopy(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/generate/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: copyPrompt,
          type: copyType,
          tone: copyTone,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate copy");
      }

      const data = await response.json();
      setGeneratedCopy(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate copy");
    } finally {
      setGeneratingCopy(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (generatedCopy) {
      navigator.clipboard.writeText(generatedCopy);
    }
  };

  const handleDownloadImage = () => {
    if (generatedImage) {
      const link = document.createElement("a");
      link.href = generatedImage;
      link.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <BentoCard variant={variant} span={span} className={cn("min-h-[600px]", className)} {...props}>
      <BentoCardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-brand/10 border border-white/10">
            <Sparkles className="w-5 h-5 text-brand-primary" />
          </div>
          <BentoCardTitle className="text-2xl">AI Media Generator</BentoCardTitle>
        </div>
        <BentoCardDescription>
          Create professional marketing assets with AI-powered generation
        </BentoCardDescription>
      </BentoCardHeader>

      <BentoCardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "image" | "copy")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="image" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Image Generation
            </TabsTrigger>
            <TabsTrigger value="copy" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Copy Generation
            </TabsTrigger>
          </TabsList>

          {/* Image Generation Tab */}
          <TabsContent value="image" className="space-y-6 mt-6">
            <div className="space-y-3">
              <Label htmlFor="image-prompt" className="text-sm font-medium">
                Describe the image you want to create
              </Label>
              <Textarea
                id="image-prompt"
                placeholder="E.g., A modern office workspace with natural lighting, professional photography style"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className="min-h-[100px] resize-none bg-background/50 border-white/10"
              />
              <p className="text-xs text-muted-foreground">
                Be specific about style, colors, mood, and composition for best results
              </p>
            </div>

            <Button
              onClick={handleGenerateImage}
              disabled={!imagePrompt.trim() || generatingImage}
              className="w-full"
              variant="gradient"
              size="lg"
            >
              {generatingImage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Image
                </>
              )}
            </Button>

            {/* Image Preview */}
            {generatedImage && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-white/10 bg-card/50 aspect-video">
                  <Image
                    src={generatedImage}
                    alt="AI Generated"
                    fill
                    sizes="100vw"
                    loader={rawImageLoader}
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleDownloadImage} variant="outline" className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Save to Library
                  </Button>
                </div>
              </div>
            )}

            {/* Loading Shimmer */}
            {generatingImage && !generatedImage && (
              <div className="relative rounded-xl overflow-hidden border border-white/10 bg-card/50 aspect-video">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
              </div>
            )}
          </TabsContent>

          {/* Copy Generation Tab */}
          <TabsContent value="copy" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="copy-type" className="text-sm font-medium">
                  Content Type
                </Label>
                <Select value={copyType} onValueChange={(v) => setCopyType(v as typeof copyType)}>
                  <SelectTrigger id="copy-type" className="bg-background/50 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email Campaign</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="ad">Advertisement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="copy-tone" className="text-sm font-medium">
                  Tone
                </Label>
                <Select value={copyTone} onValueChange={(v) => setCopyTone(v as typeof copyTone)}>
                  <SelectTrigger id="copy-tone" className="bg-background/50 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="persuasive">Persuasive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="copy-prompt" className="text-sm font-medium">
                Describe what you want to communicate
              </Label>
              <Textarea
                id="copy-prompt"
                placeholder="E.g., Promote our new product launch with a focus on sustainability and innovation"
                value={copyPrompt}
                onChange={(e) => setCopyPrompt(e.target.value)}
                className="min-h-[100px] resize-none bg-background/50 border-white/10"
              />
              <p className="text-xs text-muted-foreground">
                Include key points, target audience, and call-to-action
              </p>
            </div>

            <Button
              onClick={handleGenerateCopy}
              disabled={!copyPrompt.trim() || generatingCopy}
              className="w-full"
              variant="gradient"
              size="lg"
            >
              {generatingCopy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Copy
                </>
              )}
            </Button>

            {/* Copy Preview */}
            {generatedCopy && (
              <div className="space-y-4">
                <div className="relative rounded-xl border border-white/10 bg-card/50 p-6">
                  <div className="prose prose-invert max-w-none">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {generatedCopy}
                    </p>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="text-xs text-muted-foreground">
                      {generatedCopy.length} characters
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleCopyToClipboard} variant="outline" className="flex-1">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy to Clipboard
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Save to Library
                  </Button>
                </div>
              </div>
            )}

            {/* Loading Shimmer */}
            {generatingCopy && !generatedCopy && (
              <div className="relative rounded-xl border border-white/10 bg-card/50 p-6 min-h-[150px]">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </BentoCardContent>
    </BentoCard>
  );
}
