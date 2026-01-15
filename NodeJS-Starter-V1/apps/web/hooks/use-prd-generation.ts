"use client";

import { useState, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api/client";

export type PRDGenerationRequest = {
  requirements: string;
  context?: {
    target_users?: string;
    timeline?: string;
    team_size?: string;
    technical_constraints?: string;
  };
};

export type PRDResult = {
  total_user_stories: number;
  total_api_endpoints: number;
  total_test_scenarios: number;
  total_sprints: number;
  estimated_duration_weeks: number;
  documents_generated: string[];
};

export type PRDStatus = "generating" | "completed" | "failed";

export function usePRDGenerationWithProgress() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PRDResult | null>(null);
  const [prdId, setPrdId] = useState<string | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  const pollPRDStatus = useCallback(async (id: string) => {
    try {
      const response = await apiClient.get(`/api/prd/${id}`);
      const data = response.data;

      if (data.status === "completed") {
        setResult({
          total_user_stories: data.total_user_stories,
          total_api_endpoints: data.total_api_endpoints,
          total_test_scenarios: data.total_test_scenarios,
          total_sprints: data.total_sprints,
          estimated_duration_weeks: data.estimated_duration_weeks,
          documents_generated: data.documents_generated || [],
        });
        setProgress(100);
        setCurrentStep("Completed!");
        setIsGenerating(false);
        stopPolling();
      } else if (data.status === "failed") {
        setError(data.error_message || "PRD generation failed");
        setIsGenerating(false);
        stopPolling();
      } else {
        // Still generating - update progress
        // Estimate progress based on time elapsed (max 2 minutes)
        const elapsedTime = new Date().getTime() - new Date(data.created_at).getTime();
        const estimatedProgress = Math.min(95, (elapsedTime / 120000) * 100);
        setProgress(estimatedProgress);

        // Update step based on progress
        if (estimatedProgress < 20) {
          setCurrentStep("Analyzing requirements");
        } else if (estimatedProgress < 40) {
          setCurrentStep("Decomposing features into user stories");
        } else if (estimatedProgress < 60) {
          setCurrentStep("Generating technical specification");
        } else if (estimatedProgress < 80) {
          setCurrentStep("Creating test plan");
        } else {
          setCurrentStep("Planning implementation roadmap");
        }
      }
    } catch (err) {
      console.error("Error polling PRD status:", err);
      // Don't stop polling on error, might be temporary
    }
  }, [stopPolling]);

  const generatePRD = useCallback(async (request: PRDGenerationRequest) => {
    try {
      setIsGenerating(true);
      setProgress(0);
      setCurrentStep("Initializing...");
      setError(null);
      setResult(null);
      setPrdId(null);

      // Start PRD generation
      const response = await apiClient.post("/api/prd/generate", request);
      const data = response.data;

      if (data.id) {
        setPrdId(data.id);

        // Start polling for status
        pollingInterval.current = setInterval(() => {
          pollPRDStatus(data.id);
        }, 2000); // Poll every 2 seconds

        // Initial poll
        await pollPRDStatus(data.id);
      } else {
        throw new Error("No PRD ID returned from server");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to start PRD generation");
      setIsGenerating(false);
      stopPolling();
    }
  }, [pollPRDStatus, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setIsGenerating(false);
    setProgress(0);
    setCurrentStep(null);
    setError(null);
    setResult(null);
    setPrdId(null);
  }, [stopPolling]);

  return {
    isGenerating,
    progress,
    currentStep,
    error,
    result,
    prdId,
    generatePRD,
    reset,
  };
}
