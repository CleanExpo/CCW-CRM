"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";
import { CompanySetupStep } from "./CompanySetupStep";
import { ShopifyConnectStep } from "./ShopifyConnectStep";
import { SampleDataStep } from "./SampleDataStep";
import { TeamInviteStep } from "./TeamInviteStep";
import { FirstQuoteStep } from "./FirstQuoteStep";

export type OnboardingStep = "company" | "shopify" | "data" | "team" | "quote";

interface StepConfig {
  id: OnboardingStep;
  title: string;
  description: string;
  optional?: boolean;
}

const STEPS: StepConfig[] = [
  {
    id: "company",
    title: "Company Setup",
    description: "Tell us about your business",
  },
  {
    id: "shopify",
    title: "Connect Shopify",
    description: "Sync your products and orders",
    optional: true,
  },
  {
    id: "data",
    title: "Sample Data",
    description: "Generate demo data to explore",
    optional: true,
  },
  {
    id: "team",
    title: "Invite Team",
    description: "Add your team members",
    optional: true,
  },
  {
    id: "quote",
    title: "First Quote",
    description: "Create your first quote",
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStep>>(new Set());
  const [stepData, setStepData] = useState<Record<string, any>>({});

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const currentStepConfig = STEPS[currentStep];

  const handleStepComplete = (data?: any) => {
    // Save step data
    if (data) {
      setStepData((prev) => ({ ...prev, [currentStepConfig.id]: data }));
    }

    // Mark step as completed
    setCompletedSteps((prev) => new Set(prev).add(currentStepConfig.id));

    // Move to next step or finish
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleStepSkip = () => {
    if (currentStepConfig.optional) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        handleFinish();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    // Save onboarding completion status
    localStorage.setItem("onboarding_completed", "true");
    router.push("/dashboard");
  };

  const renderStep = () => {
    const stepId = currentStepConfig.id;
    const commonProps = {
      onComplete: handleStepComplete,
      onSkip: handleStepSkip,
      onBack: handleBack,
      canGoBack: currentStep > 0,
      isOptional: currentStepConfig.optional || false,
      data: stepData[stepId],
    };

    switch (stepId) {
      case "company":
        return <CompanySetupStep {...commonProps} />;
      case "shopify":
        return <ShopifyConnectStep {...commonProps} />;
      case "data":
        return <SampleDataStep {...commonProps} />;
      case "team":
        return <TeamInviteStep {...commonProps} />;
      case "quote":
        return <FirstQuoteStep {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Welcome to CCW ERP</h1>
            <span className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </span>
          </div>

          <Progress value={progress} className="h-2" />

          {/* Step indicators */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isCompleted = completedSteps.has(step.id);
              const isCurrent = index === currentStep;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 ${
                    isCurrent ? "text-primary" : isCompleted ? "text-green-500" : "text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs ${
                        isCurrent ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </div>
                  )}
                  <span className="text-sm font-medium hidden md:inline">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{currentStepConfig.title}</CardTitle>
            <CardDescription>{currentStepConfig.description}</CardDescription>
          </CardHeader>
          <CardContent>{renderStep()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
