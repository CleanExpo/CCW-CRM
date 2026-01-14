"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { InsightCard } from "@/components/insights/insight-card";
import {
  generateInsights,
  getDashboardInsights,
  type Insight,
  type GenerateInsightsRequest,
} from "@/lib/api/ai-insights";
import { useToast } from "@/hooks/use-toast";

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardInsights();
  }, []);

  const loadDashboardInsights = async () => {
    setIsLoading(true);
    try {
      const response = await getDashboardInsights(50);
      setInsights(response.insights);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load insights",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!selectedCategory || selectedCategory === "all") {
      toast({
        title: "Please select a category",
        description: "Choose a specific category to generate insights",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const request: GenerateInsightsRequest = {
        category: selectedCategory as any,
        filters: {},
      };

      const response = await generateInsights(request);

      if (response.summary?.error) {
        throw new Error(response.summary.error);
      }

      toast({
        title: "Insights generated",
        description: `Generated ${response.total_insights} insights for ${selectedCategory}`,
      });

      // Reload insights
      await loadDashboardInsights();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate insights",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter insights based on active tab and priority
  const filteredInsights = insights.filter((insight) => {
    const matchesCategory =
      activeTab === "all" || insight.category === activeTab;
    const matchesPriority =
      selectedPriority === "all" || insight.priority === selectedPriority;
    return matchesCategory && matchesPriority;
  });

  // Get category counts
  const categoryCounts = insights.reduce((acc, insight) => {
    acc[insight.category] = (acc[insight.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get priority insights
  const priorityInsights = insights.filter((i) => i.priority === "high");

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            AI Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Automated business intelligence and recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardInsights}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Priority Insights Banner */}
      {priorityInsights.length > 0 && (
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {priorityInsights.length} High Priority Insight
              {priorityInsights.length !== 1 && "s"}
            </CardTitle>
            <CardDescription>Urgent recommendations requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {priorityInsights.slice(0, 3).map((insight) => (
                <InsightCard key={insight.id} insight={insight} defaultExpanded />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Generate New Insights</CardTitle>
          <CardDescription>
            Select a category to analyze and generate AI-powered insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="orders">Orders</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleGenerateInsights}
              disabled={isGenerating || !selectedCategory || selectedCategory === "all"}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={selectedPriority} onValueChange={setSelectedPriority}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High Priority</SelectItem>
            <SelectItem value="medium">Medium Priority</SelectItem>
            <SelectItem value="low">Low Priority</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          Showing {filteredInsights.length} of {insights.length} insights
        </div>
      </div>

      {/* Insights by Category */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({insights.length})
          </TabsTrigger>
          <TabsTrigger value="sales">
            Sales ({categoryCounts.sales || 0})
          </TabsTrigger>
          <TabsTrigger value="inventory">
            Inventory ({categoryCounts.inventory || 0})
          </TabsTrigger>
          <TabsTrigger value="customers">
            Customers ({categoryCounts.customers || 0})
          </TabsTrigger>
          <TabsTrigger value="orders">
            Orders ({categoryCounts.orders || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInsights.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No insights yet</p>
                  <p className="text-sm mt-2">
                    Generate insights for a category to see recommendations
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
