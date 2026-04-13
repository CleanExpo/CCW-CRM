'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2 } from 'lucide-react';
import { WelcomeStep } from './WelcomeStep';
import { XeroConnectStep } from './XeroConnectStep';
import { ShopifyConnectStep } from './ShopifyConnectStep';

export type OnboardingStep = 'welcome' | 'xero' | 'shopify';

interface StepConfig {
  id: OnboardingStep;
  title: string;
  description: string;
  optional?: boolean;
}

const STEPS: StepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: "Let's get you set up",
  },
  {
    id: 'xero',
    title: 'Connect Xero',
    description: 'Import customers & invoices',
    optional: true,
  },
  {
    id: 'shopify',
    title: 'Connect Shopify',
    description: 'Sync products & stock',
    optional: true,
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStep>>(new Set());

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const currentStepConfig = STEPS[currentStep];

  const handleStepComplete = (data?: Record<string, unknown>) => {
    void data;
    setCompletedSteps((prev) => new Set(prev).add(currentStepConfig.id));
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
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleFinish = () => {
    localStorage.setItem('onboarding_completed', 'true');
    router.push('/dashboard');
  };

  const renderStep = () => {
    const commonProps = {
      onComplete: handleStepComplete,
      onSkip: handleStepSkip,
      onBack: handleBack,
      canGoBack: currentStep > 0,
      isOptional: currentStepConfig.optional ?? false,
    };
    switch (currentStepConfig.id) {
      case 'welcome':
        return <WelcomeStep {...commonProps} />;
      case 'xero':
        return <XeroConnectStep {...commonProps} />;
      case 'shopify':
        return <ShopifyConnectStep {...commonProps} />;
    }
  };

  return (
    <div className="from-background to-muted/20 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Step indicators */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 text-sm ${
                index === currentStep
                  ? 'text-foreground font-medium'
                  : index < currentStep
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/50'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                  completedSteps.has(step.id)
                    ? 'bg-primary border-primary text-primary-foreground'
                    : index === currentStep
                      ? 'border-primary text-primary'
                      : 'border-muted-foreground/30 text-muted-foreground/50'
                }`}
              >
                {completedSteps.has(step.id) ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <span className="hidden sm:block">{step.title}</span>
            </div>
          ))}
        </div>

        <Progress value={progress} className="h-1" />

        <Card>
          <CardHeader>
            <CardTitle>{currentStepConfig.title}</CardTitle>
            <CardDescription>{currentStepConfig.description}</CardDescription>
          </CardHeader>
          <CardContent>{renderStep()}</CardContent>
        </Card>

        {/* Skip all — visible from step 2 onward */}
        {currentStep > 0 && (
          <p className="text-muted-foreground text-center text-xs">
            <button type="button" className="hover:underline" onClick={handleFinish}>
              Skip setup — I&apos;ll connect integrations from Settings later
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
