"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import type { PRDDetail } from "@/types/prd";
import {
  ArrowLeft,
  Download,
  FileText,
  Users,
  Code,
  TestTube,
  Calendar,
  CheckCircle2,
  Clock
} from "lucide-react";

interface PRDDetailViewProps {
  prd: PRDDetail;
}

export function PRDDetailView({ prd }: PRDDetailViewProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderSection = (title: string, content: any) => {
    if (!content) {
      return <p className="text-muted-foreground">Not generated</p>;
    }

    if (typeof content === "string") {
      return <div className="prose dark:prose-invert max-w-none">{content}</div>;
    }

    return (
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/prd/generate">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Product Requirements Document</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Generated {formatDate(prd.created_at)}
            </span>
            <Badge variant={prd.status === "completed" ? "default" : "secondary"}>
              {prd.status}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="lg">
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{prd.total_user_stories}</div>
            <div className="text-xs text-muted-foreground mt-1">User Stories</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{prd.total_api_endpoints}</div>
            <div className="text-xs text-muted-foreground mt-1">API Endpoints</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{prd.total_test_scenarios}</div>
            <div className="text-xs text-muted-foreground mt-1">Test Scenarios</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{prd.total_sprints}</div>
            <div className="text-xs text-muted-foreground mt-1">Sprints</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{prd.estimated_duration_weeks}w</div>
            <div className="text-xs text-muted-foreground mt-1">Est. Duration</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">
            <FileText className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="features">
            <Users className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger value="technical">
            <Code className="h-4 w-4 mr-2" />
            Technical
          </TabsTrigger>
          <TabsTrigger value="testing">
            <TestTube className="h-4 w-4 mr-2" />
            Testing
          </TabsTrigger>
          <TabsTrigger value="roadmap">
            <Calendar className="h-4 w-4 mr-2" />
            Roadmap
          </TabsTrigger>
          <TabsTrigger value="raw">
            <FileText className="h-4 w-4 mr-2" />
            Raw Data
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Original Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none">
                {prd.requirements}
              </div>
            </CardContent>
          </Card>

          {prd.executive_summary && (
            <Card>
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {renderSection("Executive Summary", prd.executive_summary)}
              </CardContent>
            </Card>
          )}

          {prd.problem_statement && (
            <Card>
              <CardHeader>
                <CardTitle>Problem Statement</CardTitle>
              </CardHeader>
              <CardContent>
                {renderSection("Problem Statement", prd.problem_statement)}
              </CardContent>
            </Card>
          )}

          {prd.prd_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>PRD Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {renderSection("Analysis", prd.prd_analysis)}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature Decomposition</CardTitle>
              <CardDescription>
                Detailed breakdown of features into user stories and acceptance criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderSection("Features", prd.feature_decomposition)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technical Tab */}
        <TabsContent value="technical" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Technical Specification</CardTitle>
              <CardDescription>
                Architecture, database schema, API endpoints, and security considerations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderSection("Technical Spec", prd.technical_spec)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Plan</CardTitle>
              <CardDescription>
                Unit, integration, and E2E test scenarios with coverage strategy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderSection("Test Plan", prd.test_plan)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roadmap Tab */}
        <TabsContent value="roadmap" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Implementation Roadmap</CardTitle>
              <CardDescription>
                Sprint breakdown, milestones, timeline, and risk mitigation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderSection("Roadmap", prd.roadmap)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raw Data Tab */}
        <TabsContent value="raw" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Raw JSON Data</CardTitle>
              <CardDescription>
                Complete PRD data in JSON format for export or processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(prd, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
