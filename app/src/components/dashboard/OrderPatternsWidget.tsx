'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BentoCardHeader,
  BentoCardTitle,
  BentoCardDescription,
  BentoCardContent,
} from '@/components/ui/bento-grid';
import {
  RefreshCw,
  TrendingUp,
  Calendar,
  Package,
  Users,
  ShoppingCart,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

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
          <BentoCardDescription>Detecting customer ordering behavior...</BentoCardDescription>
        </BentoCardHeader>
        <BentoCardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted/50 h-24 rounded-lg" />
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
            <BentoCardTitle className="text-xl">Order Patterns</BentoCardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadPatterns(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <BentoCardDescription>
          AI-detected customer behavior patterns from recent orders
        </BentoCardDescription>
      </BentoCardHeader>
      <BentoCardContent>
        {patterns.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <TrendingUp className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm">No patterns detected yet</p>
            <p className="mt-1 text-xs">More order data needed for pattern analysis</p>
          </div>
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
                  className="bg-card/50 hover:bg-card/80 rounded-lg border border-white/10 p-4 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg border p-2 ${getPatternColor(pattern.type)}`}>
                      {getPatternIcon(pattern.type)}
                    </div>
                    <div className="flex-1 space-y-2">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <h4 className="text-sm font-semibold">{pattern.customer_name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {getPatternLabel(pattern.type)}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {pattern.total_orders} orders
                            {pattern.avg_order_value &&
                              ` • Avg: ${formatCurrency(pattern.avg_order_value)}`}
                          </p>
                        </div>
                        {getConfidenceBadge(pattern.confidence)}
                      </div>

                      {/* Pattern Description */}
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {pattern.pattern_description}
                      </p>

                      {/* Additional Details */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {pattern.frequency && (
                          <div className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {pattern.frequency}
                          </div>
                        )}
                        {pattern.next_expected_order && (
                          <div className="flex items-center gap-1 text-green-500">
                            <Calendar className="h-3 w-3" />
                            Expected:{' '}
                            {formatDistanceToNow(new Date(pattern.next_expected_order), {
                              addSuffix: true,
                            })}
                          </div>
                        )}
                        {pattern.products && pattern.products.length > 0 && (
                          <div className="text-muted-foreground flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {pattern.products.length} products
                          </div>
                        )}
                      </div>

                      {/* Suggested Action */}
                      {pattern.suggested_action && (
                        <div className="bg-brand-primary/5 border-brand-primary/10 flex items-start gap-2 rounded border p-2">
                          <AlertCircle className="text-brand-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                          <p className="text-brand-primary text-xs font-medium">
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
