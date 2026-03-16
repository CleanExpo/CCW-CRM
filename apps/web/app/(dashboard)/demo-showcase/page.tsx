"use client";

import FeaturedErpDemoSection from "@/components/features/featured-erp-demo-section";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function DemoShowcasePage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Page Header */}
      <div className="space-y-4">
        <Badge variant="outline">
          <Sparkles className="w-3 h-3 mr-2" />
          Product Demo
        </Badge>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            See CCW-Online ERP in Action
          </h1>
          <p className="text-muted-foreground text-lg">
            Explore the features that make CCW-Online ERP the best choice for equipment suppliers and distributors.
          </p>
        </div>
      </div>

      {/* Featured Demo Section */}
      <FeaturedErpDemoSection />
    </motion.div>
  );
}
