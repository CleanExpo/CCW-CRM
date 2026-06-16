"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { BentoGrid, BentoCard, BentoCardHeader, BentoCardTitle, BentoCardDescription, BentoCardContent } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageIcon, FileText, Video, Search, Filter, MoreVertical, Trash2, Download, Eye, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo-mode";
import { format } from "date-fns";

/* ============================================
   ASSET LIBRARY - Generated Assets Management
   Linear-style component for viewing and managing AI-generated assets
   ============================================ */

export interface AssetLibraryProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "gradient";
  span?: 1 | 2 | 3 | 4;
}

export interface Asset {
  id: string;
  type: "image" | "copy" | "video";
  title: string;
  content: string; // URL for images/videos, text for copy
  thumbnail?: string;
  prompt: string;
  createdAt: Date;
  tags?: string[];
}

export function AssetLibrary({ className, variant = "glass", span = 3, ...props }: AssetLibraryProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "image" | "copy" | "video">("all");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai/assets");
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load assets";
      console.error("[UNI-2116] AssetLibrary fetch failed:", message);

      if (isDemoMode()) {
        // Demo mode only: show placeholder assets so the UI is not empty
        console.warn("[UNI-2116] DEMO MODE active - using demo assets");
        setAssets([
          {
            id: "1",
            type: "image",
            title: "Product Launch Hero",
            content: "https://placehold.co/600x400/4f46e5/ffffff?text=AI+Generated",
            thumbnail: "https://placehold.co/300x200/4f46e5/ffffff?text=AI+Generated",
            prompt: "Modern office workspace with natural lighting",
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            tags: ["product", "hero", "workspace"],
          },
          {
            id: "2",
            type: "copy",
            title: "Email Campaign Copy",
            content: "Discover the future of productivity with our latest innovation. Transform your workflow and achieve more with cutting-edge technology designed for the modern professional.",
            prompt: "Professional email about new product launch",
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            tags: ["email", "campaign", "product"],
          },
          {
            id: "3",
            type: "image",
            title: "Social Media Banner",
            content: "https://placehold.co/1200x630/9333ea/ffffff?text=Social+Banner",
            thumbnail: "https://placehold.co/600x315/9333ea/ffffff?text=Social+Banner",
            prompt: "Eye-catching social media banner with gradient background",
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
            tags: ["social", "banner", "gradient"],
          },
        ]);
      } else {
        // Production/staging: surface the error
        setLoadError(message);
        setAssets([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || asset.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (assetId: string) => {
    try {
      const response = await fetch(`/api/ai/assets/${assetId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setAssets(assets.filter((a) => a.id !== assetId));
      }
    } catch (error) {
      console.error("Failed to delete asset:", error);
    }
  };

  const handleDownload = (asset: Asset) => {
    if (asset.type === "image") {
      const link = document.createElement("a");
      link.href = asset.content;
      link.download = `${asset.title.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (asset.type === "copy") {
      navigator.clipboard.writeText(asset.content);
    }
  };

  const handlePreview = (asset: Asset) => {
    setSelectedAsset(asset);
    setPreviewOpen(true);
  };

  const getAssetIcon = (type: Asset["type"]) => {
    switch (type) {
      case "image":
        return <ImageIcon className="w-4 h-4" />;
      case "copy":
        return <FileText className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
    }
  };

  return (
    <>
      <BentoCard variant={variant} span={span} className={cn("min-h-[600px]", className)} {...props}>
        <BentoCardHeader>
          <div className="flex items-center justify-between">
            <div>
              <BentoCardTitle className="text-2xl">Asset Library</BentoCardTitle>
              <BentoCardDescription>
                Manage your AI-generated marketing assets
              </BentoCardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              {filteredAssets.length} {filteredAssets.length === 1 ? "asset" : "assets"}
            </Badge>
          </div>
        </BentoCardHeader>

        <BentoCardContent>
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-white/10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("all")}
              >
                All
              </Button>
              <Button
                variant={filterType === "image" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("image")}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Images
              </Button>
              <Button
                variant={filterType === "copy" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("copy")}
              >
                <FileText className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>

          {/* Asset Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="relative rounded-xl border border-white/10 bg-card/50 aspect-video overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-destructive">Asset library unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No assets found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery || filterType !== "all"
                  ? "Try adjusting your search or filters"
                  : "Generate your first asset to get started"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-xl border border-white/10 bg-card/50 overflow-hidden hover:bg-card/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Asset Preview */}
                  <div className="relative aspect-video bg-muted/20 overflow-hidden">
                    {asset.type === "image" ? (
                      <Image
                        src={asset.thumbnail || asset.content}
                        alt={asset.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        {getAssetIcon(asset.type)}
                      </div>
                    )}

                    {/* Hover Actions Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreview(asset)}
                        className="bg-background/80 backdrop-blur-sm"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(asset)}
                        className="bg-background/80 backdrop-blur-sm"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Asset Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{asset.title}</h4>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {asset.prompt}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePreview(asset)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(asset)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(asset.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {getAssetIcon(asset.type)}
                        <span className="ml-1 capitalize">{asset.type}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(asset.createdAt, "MMM dd")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </BentoCardContent>
      </BentoCard>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedAsset?.title}</DialogTitle>
            <DialogDescription>{selectedAsset?.prompt}</DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              {selectedAsset.type === "image" ? (
                <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10">
                  <Image
                    src={selectedAsset.content}
                    alt={selectedAsset.title}
                    fill
                    sizes="100vw"
                    className="object-contain bg-black/5"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-card/50 p-6">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedAsset.content}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={() => handleDownload(selectedAsset)}
                  className="flex-1"
                  variant="gradient"
                >
                  {selectedAsset.type === "copy" ? (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy to Clipboard
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleDelete(selectedAsset.id)}
                  variant="outline"
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
