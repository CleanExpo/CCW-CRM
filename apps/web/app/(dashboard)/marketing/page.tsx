"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BentoGrid, BentoCard, BentoCardHeader, BentoCardTitle, BentoCardDescription, BentoCardContent } from "@/components/ui/bento-grid";
import { BorderBeam } from "@/components/ui/border-beam";
import { MediaGenerator } from "@/components/ai-marketing/media-generator";
import { AssetLibrary } from "@/components/ai-marketing/asset-library";
import { Sparkles, TrendingUp, Zap, Image as ImageIcon } from "lucide-react";

interface MarketingStats {
  totalAssets: number;
  imagesGenerated: number;
  copyGenerated: number;
  thisMonth: number;
}

export default function MarketingPage() {
  const [stats, setStats] = useState<MarketingStats>({
    totalAssets: 0,
    imagesGenerated: 0,
    copyGenerated: 0,
    thisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        // Mock data for development
        setStats({
          totalAssets: 47,
          imagesGenerated: 28,
          copyGenerated: 19,
          thisMonth: 12,
        });
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
      // Mock data on error
      setStats({
        totalAssets: 47,
        imagesGenerated: 28,
        copyGenerated: 19,
        thisMonth: 12,
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Assets",
      value: stats.totalAssets,
      icon: Sparkles,
      color: "text-brand-primary",
      bgColor: "bg-brand-primary/10",
    },
    {
      title: "Images Generated",
      value: stats.imagesGenerated,
      icon: ImageIcon,
      color: "text-brand-secondary",
      bgColor: "bg-brand-secondary/10",
    },
    {
      title: "Copy Generated",
      value: stats.copyGenerated,
      icon: Zap,
      color: "text-brand-accent",
      bgColor: "bg-brand-accent/10",
    },
    {
      title: "This Month",
      value: stats.thisMonth,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-semibold tracking-tight">AI Marketing Hub</h1>
        <p className="text-muted-foreground text-lg mt-2">
          Generate professional marketing assets with AI-powered tools
        </p>
      </motion.div>

      {/* Bento Grid Layout */}
      <BentoGrid columns={4} gap="lg">
        {/* Stats Row - 4 cards spanning 1 column each */}
        {statCards.map((stat, index) => (
          <BentoCard key={stat.title} variant="glass" span={1} className="min-h-[120px]">
            <BentoCardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                  <p className="text-3xl font-bold">
                    {loading ? (
                      <span className="inline-block w-16 h-8 bg-muted/20 rounded animate-pulse" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor} border border-white/10`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </BentoCardContent>
          </BentoCard>
        ))}

        {/* AI Media Generator - Large card spanning 2 columns with BorderBeam */}
        <BorderBeam>
          <MediaGenerator variant="glass" span={2} className="min-h-[600px]" />
        </BorderBeam>

        {/* Quick Actions Card - 2 columns */}
        <BentoCard variant="gradient" span={2} className="min-h-[600px]">
          <BentoCardHeader>
            <BentoCardTitle className="text-white">Quick Actions</BentoCardTitle>
            <BentoCardDescription className="text-white/80">
              Common marketing tasks and templates
            </BentoCardDescription>
          </BentoCardHeader>
          <BentoCardContent>
            <div className="grid gap-4">
              <div className="p-4 rounded-lg bg-white/10 hover:bg-white/15 transition-colors cursor-pointer border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white/10">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">Product Launch Campaign</h4>
                    <p className="text-xs text-white/70 mt-1">
                      Generate hero images and announcement copy
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white/10 hover:bg-white/15 transition-colors cursor-pointer border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white/10">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">Social Media Bundle</h4>
                    <p className="text-xs text-white/70 mt-1">
                      Create complete social media post package
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white/10 hover:bg-white/15 transition-colors cursor-pointer border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white/10">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">Email Newsletter</h4>
                    <p className="text-xs text-white/70 mt-1">
                      Generate engaging email content and visuals
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white/10 hover:bg-white/15 transition-colors cursor-pointer border border-white/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white/10">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">Ad Campaign Assets</h4>
                    <p className="text-xs text-white/70 mt-1">
                      Create multiple ad variations and copy
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Asset Library - Full width spanning 4 columns */}
        <AssetLibrary variant="glass" span={4} />

        {/* Tips & Best Practices - 2 columns */}
        <BentoCard variant="elevated" span={2} className="min-h-[300px]">
          <BentoCardHeader>
            <BentoCardTitle>Tips & Best Practices</BentoCardTitle>
            <BentoCardDescription>Get the most out of AI generation</BentoCardDescription>
          </BentoCardHeader>
          <BentoCardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center text-xs font-semibold text-brand-primary">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-medium">Be Specific with Prompts</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Include details about style, mood, colors, and composition for better results
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center text-xs font-semibold text-brand-primary">
                  2
                </div>
                <div>
                  <h4 className="text-sm font-medium">Iterate and Refine</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Generate multiple variations and refine prompts based on results
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center text-xs font-semibold text-brand-primary">
                  3
                </div>
                <div>
                  <h4 className="text-sm font-medium">Use Templates</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start with quick action templates for common marketing tasks
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center text-xs font-semibold text-brand-primary">
                  4
                </div>
                <div>
                  <h4 className="text-sm font-medium">Maintain Brand Voice</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Review and adjust generated content to match your brand guidelines
                  </p>
                </div>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Recent Activity - 2 columns */}
        <BentoCard variant="glass" span={2} className="min-h-[300px]">
          <BentoCardHeader>
            <BentoCardTitle>Recent Activity</BentoCardTitle>
            <BentoCardDescription>Your latest AI generations</BentoCardDescription>
          </BentoCardHeader>
          <BentoCardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg border border-white/10 bg-card/50">
                    <div className="w-10 h-10 bg-muted/20 rounded animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted/20 rounded animate-pulse" />
                      <div className="h-3 bg-muted/20 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3 p-3 rounded-lg border border-white/10 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer">
                  <div className="flex-shrink-0 w-10 h-10 rounded bg-brand-primary/20 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Product Launch Hero</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-lg border border-white/10 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer">
                  <div className="flex-shrink-0 w-10 h-10 rounded bg-brand-secondary/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-brand-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Email Campaign Copy</p>
                    <p className="text-xs text-muted-foreground">1 day ago</p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-lg border border-white/10 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer">
                  <div className="flex-shrink-0 w-10 h-10 rounded bg-brand-primary/20 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Social Media Banner</p>
                    <p className="text-xs text-muted-foreground">2 days ago</p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-lg border border-white/10 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer">
                  <div className="flex-shrink-0 w-10 h-10 rounded bg-brand-secondary/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-brand-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Ad Copy Variation</p>
                    <p className="text-xs text-muted-foreground">3 days ago</p>
                  </div>
                </div>
              </div>
            )}
          </BentoCardContent>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
