'use client';

import { DashboardWidgetEmpty } from '@/components/dashboard/dashboard-widget-primitives';
import { Badge } from '@/components/ui/badge';
import {
  BentoCardContent,
  BentoCardDescription,
  BentoCardHeader,
  BentoCardTitle,
} from '@/components/ui/bento-grid';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  Clock,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type PatternType =
  | 'repeat_customer'
  | 'product_affinity'
  | 'reorder_timing'
  | 'bulk_buyer'
  | 'seasonal';

interface OrderPattern {
  type: PatternType;
  customer_id: string;
  customer_name: string;
  pattern_description: string;
  confidence: number; // 0-1
  suggested_action: string;
  products?: string[];
  frequency?: string; // e.g., "every 14 days"
  next_expected_order?: string; // ISO date
  last_order_date: string;
  total_orders: number;
  avg_order_value?: number;
}

interface OrderPatternsResponse {
  patterns: OrderPattern[];
  total_patterns: number;
  analysis_period: string;
  generated_at: string;
}

/**
 * PHASE C: AI Order Pattern Detection Widget
 *
 * Analyzes customer ordering behavior to identify patterns like:
 * - Repeat customers with predictable timing
 * - Product affinity (customers who buy product combos)
 * - Reorder opportunities (when to reach out)
 * - Bulk buying patterns
 * - Seasonal trends
 *
 * @example
 * <OrderPatternsWidget />
 */
export function OrderPatternsWidget() {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<OrderPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysisPeriod, setAnalysisPeriod] = useState<string>('90d');

  const loadPatterns = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await apiClient.post<OrderPatternsResponse>('/api/ai/patterns/orders', {
        period: analysisPeriod,
        min_confidence: 0.7, // Only show high-confidence patterns
        max_patterns: 10,
      });

      setPatterns(response.patterns || []);

      if (isRefresh) {
        toast({
          title: 'Patterns Refreshed',
          description: `Found ${response.total_patterns} order patterns in the last ${response.analysis_period}.`,
        });
      }
    } catch (error: unknown) {
      console.error('Failed to load order patterns:', error);
      toast({
        title: 'Failed to Load Patterns',
        description:
          error instanceof Error
            ? error.message
            : 'Could not analyze order patterns. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPatterns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisPeriod]);

  const getPatternIcon = (type: PatternType) => {
    switch (type) {
      case 'repeat_customer':
        return <Users className="h-4 w-4" />;
      case 'product_affinity':
        return <Package className="h-4 w-4" />;
      case 'reorder_timing':
        return <Clock className="h-4 w-4" />;
      case 'bulk_buyer':
        return <ShoppingCart className="h-4 w-4" />;
      case 'seasonal':
        return <Calendar className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getPatternColor = (type: PatternType) => {
    switch (type) {
      case 'repeat_customer':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'product_affinity':
        return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'reorder_timing':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'bulk_buyer':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'seasonal':
        return 'text-pink-500 bg-pink-500/10 border-pink-500/20';
      default:
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getPatternLabel = (type: PatternType) => {
    switch (type) {
      case 'repeat_customer':
        return 'Repeat Customer';
      case 'product_affinity':
        return 'Product Affinity';
      case 'reorder_timing':
        return 'Reorder Opportunity';
      case 'bulk_buyer':
        return 'Bulk Buyer';
      case 'seasonal':
        return 'Seasonal Pattern';
      default:
        return type;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';

    if (confidence >= 0.9) variant = 'default';
    else if (confidence >= 0.8) variant = 'secondary';
    else variant = 'outline';

    return (
      <Badge variant={variant} className="text-xs">
        {percentage}% confidence
      </Badge>
    );
  };

  const formatCurrency = (value?: number) => {
    if (!value) return null;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  if (loading) {
    return (
      <>
        <BentoCardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-brand/10 rounded-lg border border-white/10 p-2">
                <TrendingUp className="text-brand-primary h-5 w-5" />
              </div>
              <BentoCardTitle className="text-xl">Order Patterns</BentoCardTitle>
            </div>
          </div>
          <BentoCardDescription className="text-zinc-400">
            Detecting customer ordering behavior…
          </BentoCardDescription>
        </BentoCardHeader>
        <BentoCardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 rounded-lg border border-white/5 bg-white/[0.05]" />
              </div>
            ))}
          </div>
        </BentoCardContent>
      </>
    );
  }

  return (
    <>
      <BentoCardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-brand/10 rounded-lg border border-white/10 p-2">
              <TrendingUp className="text-brand-primary h-5 w-5" />
            </div>
            <BentoCardTitle className="text-xl text-white">Order Patterns</BentoCardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/15 text-zinc-200 hover:bg-white/10"
            onClick={() => loadPatterns(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <BentoCardDescription className="text-zinc-400">
          AI-detected customer behaviour patterns from recent orders
        </BentoCardDescription>
      </BentoCardHeader>
      <BentoCardContent>
        {patterns.length === 0 ? (
          <DashboardWidgetEmpty
            icon={TrendingUp}
            title="No order patterns detected"
            description="Patterns appear when there is enough order history and repeat behaviour. Build volume over time."
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {patterns.map((pattern, index) => (
                <motion.div
                  key={`${pattern.customer_id}-${pattern.type}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-4 ring-1 ring-white/[0.04] transition-all hover:border-indigo-500/25 hover:bg-zinc-900/80"
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg border p-2 ${getPatternColor(pattern.type)}`}>
                      {getPatternIcon(pattern.type)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-zinc-100">
                              {pattern.customer_name}
                            </h4>
                            <Badge
                              variant="outline"
                              className="border-white/15 text-xs text-zinc-200"
                            >
                              {getPatternLabel(pattern.type)}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {pattern.total_orders} orders
                            {pattern.avg_order_value &&
                              ` • Avg: ${formatCurrency(pattern.avg_order_value)}`}
                          </p>
                        </div>
                        {getConfidenceBadge(pattern.confidence)}
                      </div>

                      {/* Pattern Description */}
                      <p className="text-sm leading-relaxed text-zinc-400">
                        {pattern.pattern_description}
                      </p>

                      {/* Additional Details */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {pattern.frequency && (
                          <div className="flex items-center gap-1 text-zinc-500">
                            <Clock className="h-3 w-3" />
                            {pattern.frequency}
                          </div>
                        )}
                        {pattern.next_expected_order && (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <Calendar className="h-3 w-3" />
                            Expected:{' '}
                            {formatDistanceToNow(new Date(pattern.next_expected_order), {
                              addSuffix: true,
                            })}
                          </div>
                        )}
                        {pattern.products && pattern.products.length > 0 && (
                          <div className="flex items-center gap-1 text-zinc-500">
                            <Package className="h-3 w-3" />
                            {pattern.products.length} products
                          </div>
                        )}
                      </div>

                      {/* Suggested Action */}
                      {pattern.suggested_action && (
                        <div className="flex items-start gap-2 rounded-lg border border-sky-500/25 bg-sky-950/25 p-2 ring-1 ring-sky-500/10">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                          <p className="text-xs leading-relaxed font-medium text-sky-100/90">
                            {pattern.suggested_action}
                          </p>
                        </div>
                      )}

                      {/* Product List (if applicable) */}
                      {pattern.products && pattern.products.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {pattern.products.slice(0, 3).map((product, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {product}
                            </Badge>
                          ))}
                          {pattern.products.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{pattern.products.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </BentoCardContent>
    </>
  );
}
