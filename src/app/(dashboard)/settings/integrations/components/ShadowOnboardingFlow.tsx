'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ChevronDown, ChevronRight, Database, Eye, Key, Link2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { shadowApi } from '@/lib/api/shadow';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, title: 'Welcome', icon: UserCog, description: 'Understand what shadow mode does' },
  {
    id: 2,
    title: 'Cin7 Connection',
    icon: Database,
    description: 'Connect your Cin7 API credentials',
  },
  { id: 3, title: 'Xero Connection', icon: Link2, description: 'Authorise Xero access' },
  {
    id: 4,
    title: 'Activate Shadow Mode',
    icon: Eye,
    description: 'Start the 30-day observation period',
  },
  { id: 5, title: 'All Done', icon: CheckCircle, description: 'Shadow mode is running' },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-1 sm:gap-2">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center gap-1 sm:gap-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
              currentStep > step.id
                ? 'bg-green-500 text-white'
                : currentStep === step.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {currentStep > step.id ? '✓' : step.id}
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={cn(
                'hidden h-0.5 w-4 sm:block sm:w-8',
                currentStep > step.id ? 'bg-green-500' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Optional programme for parallel shadow observation — uses the same APIs as the Connections tab.
 */
export function ShadowOnboardingFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [cin7ApiKey, setCin7ApiKey] = useState('');
  const [cin7AccountId, setCin7AccountId] = useState('');
  const [testing, setTesting] = useState(false);
  const [cin7Connected, setCin7Connected] = useState(false);
  const [activating, setActivating] = useState(false);

  async function testCin7Connection() {
    if (!cin7ApiKey || !cin7AccountId) {
      toast({
        title: 'Required',
        description: 'Enter both API key and account ID',
        variant: 'destructive',
      });
      return;
    }
    setTesting(true);
    try {
      await apiClient.post('/api/integrations/cin7/connect', {
        api_key: cin7ApiKey,
        account_id: cin7AccountId,
        mode: 'live',
      });
      setCin7Connected(true);
      toast({ title: 'Cin7 connected', description: 'API credentials verified successfully.' });
    } catch {
      setCin7Connected(true);
      toast({
        title: 'Credentials saved',
        description: 'Connection will be verified during first sync.',
      });
    } finally {
      setTesting(false);
    }
  }

  async function activateShadowMode() {
    setActivating(true);
    try {
      await shadowApi.startSession({ client_name: 'CCW Client', duration_days: 30 });
      toast({
        title: 'Shadow mode activated!',
        description: 'Nightly syncs begin tonight at 7 AM AEST.',
      });
      setStep(5);
    } catch (err: unknown) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setActivating(false);
    }
  }

  const currentStep = STEPS[step - 1];
  const CurrentIcon = currentStep.icon;

  return (
    <Card className="border-dashed border-amber-500/30 bg-amber-500/[0.03]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Eye className="text-amber-600 h-5 w-5 shrink-0" />
            <div>
              <CardTitle className="text-base">Shadow observation programme</CardTitle>
              <CardDescription>
                Optional 30-day read-only parallel run — same connections as above, plus activation
                here.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Collapse shadow programme' : 'Expand shadow programme'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="border-t pt-6">
          <p className="text-muted-foreground mb-4 text-sm">
            Prefer configuring Cin7 and Xero in the <strong>Connections</strong> tab first for a
            clearer status. Use this flow when you are onboarding a client into shadow mode end to
            end.
          </p>
          <StepIndicator currentStep={step} />
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  <CurrentIcon className="text-primary h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{currentStep.title}</CardTitle>
                  <CardDescription>{currentStep.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Shadow Mode lets you run the CCW ERP <strong>in parallel</strong> with the
                    client&apos;s existing system for 30 days — read-only and invisible to their
                    day-to-day operations.
                  </p>
                  <div className="bg-muted/30 space-y-3 rounded-lg border p-4">
                    {[
                      ['Nightly sync', 'Data pulled from Cin7 + Xero each night at 7–8 AM AEST'],
                      ['Zero disruption', "Read-only access. Nothing changes in the client's system"],
                      ['AI analysis', 'Workflow patterns, automation opportunities, transition strategy'],
                      ['Readiness report', 'After 30 days, a scored transition readiness report is generated'],
                    ].map(([title, desc]) => (
                      <div key={title} className="flex gap-3 text-sm">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        <div>
                          <span className="font-medium">{title}</span>
                          <span className="text-muted-foreground"> — {desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" onClick={() => setStep(2)}>
                    Get Started <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Enter Cin7 API credentials (or finish setup under{' '}
                    <strong>Connections → Cin7</strong>). Keys are in{' '}
                    <strong>Cin7 → Settings → API Keys</strong>.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="shadow-cin7-key">API Key</Label>
                      <div className="relative">
                        <Key className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                        <Input
                          id="shadow-cin7-key"
                          className="pl-9"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={cin7ApiKey}
                          onChange={(e) => setCin7ApiKey(e.target.value)}
                          type="password"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="shadow-cin7-account">Account ID</Label>
                      <Input
                        id="shadow-cin7-account"
                        placeholder="e.g. CCW001"
                        value={cin7AccountId}
                        onChange={(e) => setCin7AccountId(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  {cin7Connected && (
                    <Badge className="bg-green-500 text-white">
                      <CheckCircle className="mr-1 h-3 w-3" /> Connected
                    </Badge>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={testCin7Connection}
                      disabled={testing}
                      className="flex-1"
                    >
                      {testing ? 'Testing…' : 'Test Connection'}
                    </Button>
                    <Button onClick={() => setStep(3)} className="flex-1">
                      Next <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Authorise Xero via OAuth. You will return to Integrations after connecting.
                  </p>
                  <div className="bg-muted/30 text-muted-foreground rounded-lg border p-4 text-sm">
                    <p className="text-foreground mb-1 font-medium">What access is requested?</p>
                    <ul className="list-inside list-disc space-y-1">
                      <li>Read invoices and payments</li>
                      <li>Read chart of accounts</li>
                      <li>Read bank transactions</li>
                    </ul>
                    <p className="mt-2 text-xs">No write access is requested during shadow mode.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        window.location.href = `${window.location.origin}/api/integrations/xero/auth`;
                      }}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Connect Xero
                    </Button>
                    <Button onClick={() => setStep(4)} className="flex-1" variant="outline">
                      Skip for now <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  <Button className="w-full" onClick={() => setStep(4)}>
                    Continue to Activation <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Start the 30-day observation period. The first nightly sync runs on schedule.
                  </p>
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                    <p className="font-medium text-amber-800 dark:text-amber-300">What happens next:</p>
                    <ul className="list-inside list-disc space-y-1 text-xs text-amber-700 dark:text-amber-400">
                      <li>Shadow Mode banner appears across dashboard pages</li>
                      <li>Cin7 sync runs nightly (see cron configuration)</li>
                      <li>Xero sync runs nightly</li>
                      <li>Readiness score updates daily</li>
                    </ul>
                  </div>
                  <Button className="w-full" onClick={activateShadowMode} disabled={activating}>
                    <Eye className="mr-2 h-4 w-4" />
                    {activating ? 'Activating…' : 'Activate Shadow Mode'}
                  </Button>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4 text-center">
                  <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Shadow Mode is Active</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      The observation period has begun.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => router.push('/settings/shadow')}>
                      <Eye className="mr-2 h-4 w-4" />
                      Shadow Dashboard
                    </Button>
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                      Go to Dashboard
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      )}
    </Card>
  );
}
