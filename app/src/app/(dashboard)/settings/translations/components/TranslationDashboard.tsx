'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CoverageStats } from './CoverageStats';
import { ProductList } from './ProductList';
import { BulkTranslateDialog } from './BulkTranslateDialog';

interface Language {
  code: string;
  name: string;
  native_name: string;
  is_rtl: boolean;
}

interface CoverageData {
  language_code: string;
  language_name: string;
  total_products: number;
  translated_products: number;
  pending_products: number;
  ai_generated: number;
  human_reviewed: number;
  approved: number;
  coverage_percentage: number;
}

export function TranslationDashboard() {
  const { toast } = useToast();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [coverage, setCoverage] = useState<CoverageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      const [languagesData, coverageData] = await Promise.all([
        apiClient.get<Language[]>('/api/translations/languages'),
        apiClient.get<CoverageData[]>('/api/translations/coverage'),
      ]);

      setLanguages(languagesData);
      setCoverage(coverageData);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading translation dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            {languages.length} languages supported · {coverage.length} language reports available
          </p>
        </div>
        <BulkTranslateDialog languages={languages} onSuccess={loadDashboardData} />
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Coverage Overview</TabsTrigger>
          <TabsTrigger value="products">Product Translations</TabsTrigger>
          <TabsTrigger value="review">Review Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Translation Coverage Statistics</CardTitle>
              <CardDescription>
                Overview of translation completeness across all supported languages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CoverageStats data={coverage} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Translations</CardTitle>
              <CardDescription>View and manage translations for all products</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductList languages={languages} onRefresh={loadDashboardData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review Queue</CardTitle>
              <CardDescription>AI-generated translations pending human review</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductList
                languages={languages}
                onRefresh={loadDashboardData}
                defaultFilter={{ translation_status: 'ai_generated' }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
