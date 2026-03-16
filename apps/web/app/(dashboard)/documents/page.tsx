"use client";

import { DocumentMediaPlayer } from "@/components/ui/document-media-player";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GlassButton } from "@/components/ui/glass-button";
import { FileText, Upload, FolderOpen, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const stats = [
  {
    label: "Total Documents",
    value: "247",
    icon: FileText,
    change: "+12 this week",
  },
  {
    label: "Training Videos",
    value: "34",
    icon: FolderOpen,
    change: "2 new",
  },
  {
    label: "Downloads",
    value: "1,234",
    icon: TrendingUp,
    change: "+23% this month",
  },
];

export default function DocumentsPage() {
  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <Badge variant="outline">
              <FileText className="w-3 h-3 mr-2" />
              Document Library
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight">
              Documents & Training
            </h1>
            <p className="text-muted-foreground text-lg max-w-3xl">
              Access product manuals, safety documentation, training videos, and installation guides. All your essential materials in one place.
            </p>
          </div>

          <GlassButton contentClassName="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload Document
          </GlassButton>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 rounded-lg bg-brand-primary/10">
                        <Icon className="w-5 h-5 text-brand-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {stat.change}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Document Media Player */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <DocumentMediaPlayer />
      </motion.div>

      {/* Additional Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="border-brand-primary/20 bg-gradient-brand/5">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-xl font-semibold">
                  Need a Specific Document?
                </h3>
                <p className="text-muted-foreground text-sm">
                  Can't find what you're looking for? Request a document and our team will upload it within 24 hours.
                </p>
                <GlassButton size="sm">Request Document</GlassButton>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold">
                  Share with Customers
                </h3>
                <p className="text-muted-foreground text-sm">
                  Generate secure links to share specific documents with your customers via email or customer portal.
                </p>
                <Link href="/customers">
                  <GlassButton size="sm">Manage Sharing</GlassButton>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
