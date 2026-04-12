'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  BentoCardHeader,
  BentoCardTitle,
  BentoCardDescription,
  BentoCardContent,
} from '@/components/ui/bento-grid';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface SalesInsight {
  type: 'trend' | 'opportunity' | 'warning' | 'recommendation';
  title: string;
  description: string;
  metric?: string;
  change?: number; // percentage change
}

interface SalesInsightsResponse {
  insights: SalesInsight[];
  generated_at: string;
  summary: string;
}

/**
 * PHASE C: AI Sales Insights Widget
 *
 * Displays AI-generated sales analysis including trends, opportunities,
 * warnings, and actionable recommendations. Updates on demand with refresh button.
 *
 * @example
 * <SalesInsightsWidget />
 */
export function SalesInsightsWidget() {
  const { toast } = useToast();
  const [insights, setInsights] = useState<SalesInsight[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInsights = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await apiClient.post<SalesInsightsResponse>('/api/ai/insights/sales', {
        period: '30d', // Last 30 days
        include_recommendations: true,
      });

      setInsights(response.insights || []);
      setSummary(response.summary || '');

      if (isRefresh) {
        toast({
          title: 'Insights Refreshed',
          description: 'Sales insights have been updated with the latest data.',
        });
      }
    } catch (error: unknown) {
      console.error('Failed to load sales insights:', error);
      toast({
        title: 'Failed to Load Insights',
        description:
          error instanceof Error
            ? error.message
            : 'Could not generate sales insights. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getInsightIcon = (type: SalesInsight['type']) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="h-4 w-4" />;
      case 'opportunity':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      case 'recommendation':
        return <Sparkles className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getInsightColor = (type: SalesInsight['type']) => {
    switch (type) {
      case 'trend':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'opportunity':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'warning':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'recommendation':
        return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      default:
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getChangeIndicator = (change?: number) => {
    if (!change) return null;
    const isPositive = change > 0;
    return (
      <span
        className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}
      >
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(change)}%
      </span>
    );
  };

  if (loading) {
    return (
      <>
        <BentoCardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-brand/10 rounded-lg border border-white/10 p-2">
                <Sparkles className="text-brand-primary h-5 w-5" />
              </div>
              <BentoCardTitle className="text-xl">AI Sales Insights</BentoCardTitle>
            </div>
          </div>
          <BentoCardDescription>Analyzing sales patterns and trends...</BentoCardDescription>
        </BentoCardHeader>
        <BentoCardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted/50 h-20 rounded-lg" />
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
              <Sparkles className="text-brand-primary h-5 w-5" />
            </div>
            <BentoCardTitle className="text-xl">AI Sales Insights</BentoCardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadInsights(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <BentoCardDescription>
          {summary || 'AI-powered analysis of your sales performance'}
        </BentoCardDescription>
      </BentoCardHeader>
      <BentoCardContent>
        {insights.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Sparkles className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm">No insights available yet</p>
            <p className="mt-1 text-xs">Generate more sales data to see AI insights</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <motion.div
                  key={`${insight.type}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="bg-card/50 hover:bg-card/80 rounded-lg border border-white/10 p-4 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg border p-2 ${getInsightColor(insight.type)}`}>
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">{insight.title}</h4>
                        {insight.change !== undefined && getChangeIndicator(insight.change)}
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {insight.description}
                      </p>
                      {insight.metric && (
                        <p className="text-brand-primary mt-2 text-xs font-medium">
                          {insight.metric}
                        </p>
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
