'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CompanySetupStep, type CompanySetupValues } from './CompanySetupStep';

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<'company' | 'ready'>('company');

  function finish() {
    try {
      localStorage.setItem('onboarding_completed', 'true');
    } catch {
      /* ignore */
    }
    router.push('/dashboard');
  }

  return (
    <div className="from-background to-muted/20 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
      <div className="w-full max-w-xl">
        <div className="mb-6 space-y-3">
          <h1 className="text-3xl font-bold">Welcome to Optix</h1>
          <Progress value={step === 'company' ? 50 : 100} className="h-2" />
        </div>
        <Card>
          {step === 'company' ? (
            <>
              <CardHeader>
                <CardTitle>Your workspace</CardTitle>
                <CardDescription>Name the company this account belongs to.</CardDescription>
              </CardHeader>
              <CardContent>
                <CompanySetupStep
                  onComplete={(_data: CompanySetupValues) => {
                    setStep('ready');
                  }}
                />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>You are ready</CardTitle>
                <CardDescription>Open the operations dashboard. Integrations can wait.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  data-testid="finish-onboarding"
                  className="w-full"
                  onClick={finish}
                >
                  Go to dashboard
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
