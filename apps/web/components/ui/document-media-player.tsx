"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GlassButton } from "@/components/ui/glass-button";
import {
  FileText,
  Download,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FileVideo,
  X,
} from "lucide-react";

export interface Document {
  id: string;
  title: string;
  category: string;
  type: "pdf" | "video" | "image";
  duration?: string;
  fileSize: string;
  url: string;
  thumbnail?: string;
}

const documentLibrary: Document[] = [
  {
    id: "1",
    title: "Product Installation Guide",
    category: "Installation Guides",
    type: "pdf",
    fileSize: "2.4 MB",
    url: "/docs/installation-guide.pdf",
  },
  {
    id: "2",
    title: "Safety Data Sheet - Heavy Equipment",
    category: "Safety Documents",
    type: "pdf",
    fileSize: "1.8 MB",
    url: "/docs/safety-heavy-equipment.pdf",
  },
  {
    id: "3",
    title: "Equipment Operation Training",
    category: "Training Videos",
    type: "video",
    duration: "12:45",
    fileSize: "145 MB",
    url: "/videos/equipment-training.mp4",
  },
  {
    id: "4",
    title: "Maintenance Best Practices",
    category: "Training Videos",
    type: "video",
    duration: "8:30",
    fileSize: "98 MB",
    url: "/videos/maintenance-guide.mp4",
  },
  {
    id: "5",
    title: "Product Specifications Sheet",
    category: "Product Manuals",
    type: "pdf",
    fileSize: "3.1 MB",
    url: "/docs/product-specs.pdf",
  },
  {
    id: "6",
    title: "Warranty Information",
    category: "Product Manuals",
    type: "pdf",
    fileSize: "0.8 MB",
    url: "/docs/warranty.pdf",
  },
];

export function DocumentMediaPlayer() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const activeDoc = documentLibrary[activeIndex];
  const categories = Array.from(new Set(documentLibrary.map((doc) => doc.category)));

  const filteredDocs = selectedCategory
    ? documentLibrary.filter((doc) => doc.category === selectedCategory)
    : documentLibrary;

  const handleDocumentClick = (index: number) => {
    setActiveIndex(documentLibrary.indexOf(filteredDocs[index]));
    setIsPlaying(false);
  };

  const handlePrevious = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : documentLibrary.length - 1));
    setIsPlaying(false);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < documentLibrary.length - 1 ? prev + 1 : 0));
    setIsPlaying(false);
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-brand-primary/[0.03] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-brand-secondary/[0.02] blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl">
        <Card className="relative overflow-hidden border border-border/50 bg-background/40 p-6 md:p-10 shadow-xl backdrop-blur-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/[0.05] via-transparent to-transparent" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Left: Document Categories & Preview */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-border/60 bg-background/40">
                    Document Library
                  </Badge>
                  {selectedCategory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCategory(null)}
                      className="h-7 gap-1 text-xs"
                    >
                      <X className="h-3 w-3" />
                      Clear filter
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    Training Materials & Documentation
                  </h2>
                  <p className="text-base leading-relaxed text-muted-foreground">
                    Access product manuals, safety documents, training videos, and installation guides.
                  </p>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    className="cursor-pointer hover:bg-brand-primary/10 transition-colors"
                    onClick={() => setSelectedCategory(category === selectedCategory ? null : category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>

              {/* Document Preview */}
              <div className="rounded-2xl border border-border/40 bg-background/70 p-6 shadow-lg backdrop-blur-2xl">
                <div className="flex items-start gap-4">
                  {/* Document Icon/Thumbnail */}
                  <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-brand-primary/20 via-brand-primary/10 to-transparent flex items-center justify-center">
                    {activeDoc.type === "video" ? (
                      <FileVideo className="h-10 w-10 text-brand-primary" />
                    ) : (
                      <FileText className="h-10 w-10 text-brand-primary" />
                    )}
                  </div>

                  {/* Document Info */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">
                        Now Viewing
                      </p>
                      <h3 className="text-xl font-semibold tracking-tight">
                        {activeDoc.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {activeDoc.category} • {activeDoc.fileSize}
                        {activeDoc.duration && ` • ${activeDoc.duration}`}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <GlassButton
                        size="sm"
                        contentClassName="flex items-center gap-2"
                        onClick={() => window.open(activeDoc.url, "_blank")}
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </GlassButton>
                      {activeDoc.type === "pdf" && (
                        <GlassButton
                          size="sm"
                          contentClassName="flex items-center gap-2"
                          onClick={() => window.open(activeDoc.url, "_blank")}
                        >
                          View PDF
                        </GlassButton>
                      )}
                    </div>
                  </div>
                </div>

                {/* Video Controls (if video) */}
                {activeDoc.type === "video" && (
                  <div className="mt-6 space-y-4">
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-[width]"
                        style={{ width: "35%" }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handlePrevious}
                          className="h-10 w-10 rounded-full border border-border/40 bg-background/60"
                        >
                          <SkipBack className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="h-12 w-12 rounded-full bg-brand-primary text-white hover:bg-brand-primary/90"
                        >
                          {isPlaying ? (
                            <Pause className="h-5 w-5" />
                          ) : (
                            <Play className="h-5 w-5 ml-0.5" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleNext}
                          className="h-10 w-10 rounded-full border border-border/40 bg-background/60"
                        >
                          <SkipForward className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {activeDoc.duration}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Document List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  All Documents ({filteredDocs.length})
                </h3>
              </div>

              <div className="relative">
                <div className="max-h-[600px] space-y-2 overflow-y-auto pr-2">
                  {filteredDocs.map((doc, index) => {
                    const isActive = documentLibrary.indexOf(doc) === activeIndex;

                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => handleDocumentClick(index)}
                        className={`group flex w-full items-center gap-3 rounded-xl border border-border/40 bg-background/60 p-4 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
                          isActive
                            ? "border-brand-primary/40 bg-brand-primary/[0.08] shadow-lg"
                            : "hover:border-border/60"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border/40 transition-colors ${
                            isActive
                              ? "bg-brand-primary/20 text-brand-primary"
                              : "bg-background/70 text-muted-foreground"
                          }`}
                        >
                          {doc.type === "video" ? (
                            <FileVideo className="h-5 w-5" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {doc.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {doc.fileSize}
                            {doc.duration && ` • ${doc.duration}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Gradient overlays */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background/90 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background/90 to-transparent" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
