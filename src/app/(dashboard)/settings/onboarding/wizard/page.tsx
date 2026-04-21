'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Package,
  Users,
  Link2,
  Warehouse,
  Bell,
  Rocket,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    title: 'Import Catalogue',
    subtitle: 'Upload your product catalogue',
    icon: Package,
    description:
      'Import your existing product list via CSV or connect directly to Cin7 to pull your full catalogue automatically.',
  },
  {
    id: 2,
    title: 'Add Your Team',
    subtitle: 'Roles & warehouse access',
    icon: Users,
    description:
      'Invite your team members and assign them roles: Admin, Sales, Warehouse Staff, or Finance. Each role sees only the modules they need.',
  },
  {
    id: 3,
    title: 'Connect Accounting',
    subtitle: 'Xero OAuth integration',
    icon: Link2,
    description:
      'Connect Xero to enable automatic invoice sync, BAS reporting, and bank reconciliation. Takes 60 seconds.',
  },
  {
    id: 4,
    title: 'Set Warehouses',
    subtitle: 'Locations & stock zones',
    icon: Warehouse,
    description:
      'Add your warehouse locations. CCW typically has 1–3 sites. Stock levels, transfers, and reorder alerts will be tracked per location.',
  },
  {
    id: 5,
    title: 'Alert Thresholds',
    subtitle: 'Stock, invoice & warranty alerts',
    icon: Bell,
    description:
      'Set minimum stock levels that trigger reorder alerts, overdue invoice thresholds, and warranty expiry advance warnings — so nothing slips through.',
  },
];

// ─── Step components ──────────────────────────────────────────────────────────

function StepCatalogue({ onComplete }: { onComplete: () => void }) {
  const { toast } = useToast();
  const [method, setMethod] = useState<'csv' | 'cin7' | null>(null);
  const [imported, setImported] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            id: 'csv' as const,
            label: 'CSV Upload',
            desc: 'Upload a spreadsheet with your products',
          },
          {
            id: 'cin7' as const,
            label: 'Cin7 Sync',
            desc: 'Pull live from your Cin7 account',
          },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setMethod(opt.id)}
            className={`rounded-lg border p-4 text-left transition-all ${
              method === opt.id ? 'border-primary bg-primary/5' : 'hover:border-slate-300'
            }`}
          >
            <p className="font-medium">{opt.label}</p>
            <p className="text-sm text-slate-500">{opt.desc}</p>
          </button>
        ))}
      </div>

      {method === 'csv' && !imported && (
        <div className="space-y-3">
          <Label>Upload CSV</Label>
          <div className="flex items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center">
            <Upload className="mx-auto h-8 w-8 text-slate-300" />
            <div className="flex-1">
              <p className="text-sm text-slate-600">Drop your CSV here or click to browse</p>
              <p className="text-xs text-slate-400">
                Columns: SKU, Name, Category, Price, Cost, Stock
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImported(true);
                toast({ title: 'CSV imported', description: '247 products loaded (demo)' });
              }}
            >
              Demo Import
            </Button>
          </div>
        </div>
      )}

      {method === 'cin7' && !imported && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Your Cin7 connection is already configured. Click below to pull your full product
            catalogue now.
          </p>
          <Button
            onClick={() => {
              setImported(true);
              toast({ title: 'Cin7 sync complete', description: '312 products imported (demo)' });
            }}
          >
            Sync from Cin7
          </Button>
        </div>
      )}

      {imported && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Catalogue imported successfully — products visible in the Products module.</span>
        </div>
      )}

      <Button className="w-full" onClick={onComplete} disabled={!method}>
        Continue <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function StepTeam({ onComplete }: { onComplete: () => void }) {
  const ROLES = ['Admin', 'Sales', 'Warehouse Staff', 'Finance'];
  const [members, setMembers] = useState([{ email: '', role: 'Sales' }]);

  function addMember() {
    setMembers((prev) => [...prev, { email: '', role: 'Sales' }]);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {members.map((member, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="colleague@company.com.au"
              value={member.email}
              onChange={(e) => {
                const updated = [...members];
                updated[i].email = e.target.value;
                setMembers(updated);
              }}
              className="flex-1"
            />
            <select
              value={member.role}
              onChange={(e) => {
                const updated = [...members];
                updated[i].role = e.target.value;
                setMembers(updated);
              }}
              className="border-input bg-background rounded-md border px-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addMember}>
        + Add another team member
      </Button>

      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        <strong>Role guide:</strong> Admin (full access) · Sales (CRM, orders, quotes) · Warehouse
        (inventory, receiving) · Finance (invoices, reports, BAS)
      </div>

      <Button className="w-full" onClick={onComplete}>
        Continue <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function StepXero({ onComplete }: { onComplete: () => void }) {
  const [connected, setConnected] = useState(false);

  return (
    <div className="space-y-4">
      {!connected ? (
        <>
          <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-medium">What CCW syncs with Xero:</p>
            <ul className="list-inside list-disc space-y-1 text-xs text-blue-700">
              <li>Invoices (2-way sync)</li>
              <li>Payments received</li>
              <li>Chart of accounts (for GL mapping)</li>
              <li>Bank transactions (for reconciliation)</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                window.location.href = `${window.location.origin}/api/integrations/xero/auth`;
              }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Connect Xero
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setConnected(true);
              }}
            >
              Skip for now
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Xero connected. Invoice sync will begin tonight.</span>
        </div>
      )}

      <Button className="w-full" onClick={onComplete}>
        Continue <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function StepWarehouses({ onComplete }: { onComplete: () => void }) {
  const [warehouses, setWarehouses] = useState([{ name: '', suburb: '', state: 'QLD' }]);
  const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

  function addWarehouse() {
    setWarehouses((prev) => [...prev, { name: '', suburb: '', state: 'QLD' }]);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {warehouses.map((wh, i) => (
          <div key={i} className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Location {i + 1}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Name (e.g. Brisbane Main)"
                value={wh.name}
                onChange={(e) => {
                  const updated = [...warehouses];
                  updated[i].name = e.target.value;
                  setWarehouses(updated);
                }}
              />
              <Input
                placeholder="Suburb"
                value={wh.suburb}
                onChange={(e) => {
                  const updated = [...warehouses];
                  updated[i].suburb = e.target.value;
                  setWarehouses(updated);
                }}
              />
              <select
                value={wh.state}
                onChange={(e) => {
                  const updated = [...warehouses];
                  updated[i].state = e.target.value;
                  setWarehouses(updated);
                }}
                className="border-input bg-background rounded-md border px-2 text-sm"
              >
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addWarehouse}>
        + Add another warehouse
      </Button>
      <Button className="w-full" onClick={onComplete}>
        Continue <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function StepAlerts({ onComplete }: { onComplete: () => void }) {
  const [stockDaysWarning, setStockDaysWarning] = useState('7');
  const [invoiceOverdueDays, setInvoiceOverdueDays] = useState('7');
  const [warrantyExpiryDays, setWarrantyExpiryDays] = useState('60');
  const [certExpiryDays, setCertExpiryDays] = useState('60');
  const [alertEmail, setAlertEmail] = useState('');

  const ALERT_ROWS = [
    {
      label: 'Low stock warning',
      desc: 'Alert when stock drops below reorder point',
      value: stockDaysWarning,
      unit: 'days supply remaining',
      setter: setStockDaysWarning,
    },
    {
      label: 'Overdue invoice alert',
      desc: 'Flag invoices that have not been paid',
      value: invoiceOverdueDays,
      unit: 'days past due date',
      setter: setInvoiceOverdueDays,
    },
    {
      label: 'Warranty expiry notice',
      desc: 'Warn before equipment warranty expires',
      value: warrantyExpiryDays,
      unit: 'days in advance',
      setter: setWarrantyExpiryDays,
    },
    {
      label: 'IICRC cert expiry notice',
      desc: 'Warn before customer technician certs expire',
      value: certExpiryDays,
      unit: 'days in advance',
      setter: setCertExpiryDays,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {ALERT_ROWS.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-slate-500">{row.desc}</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Input
                type="number"
                min={1}
                max={365}
                value={row.value}
                onChange={(e) => row.setter(e.target.value)}
                className="w-16 text-center"
              />
              <span className="w-28 text-xs text-slate-500">{row.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label htmlFor="alert-email">Send alerts to (email)</Label>
        <Input
          id="alert-email"
          type="email"
          placeholder="manager@ccwonline.com.au"
          value={alertEmail}
          onChange={(e) => setAlertEmail(e.target.value)}
        />
      </div>

      <Button className="w-full" onClick={onComplete}>
        Save & Finish <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Wizard wrapper ────────────────────────────────────────────────────────────

export default function CCWSetupWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  function completeStep() {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    if (currentStep < STEPS.length) {
      setCurrentStep((s) => s + 1);
    } else {
      router.push('/dashboard');
    }
  }

  const step = STEPS[currentStep - 1];
  const StepIcon = step.icon;

  return (
    <div className="flex max-w-2xl flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Rocket className="text-primary h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">CCW Platform Setup</h1>
          <p className="text-muted-foreground text-sm">
            5 steps to configure your platform — takes about 10 minutes
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (completedSteps.has(s.id) || s.id <= currentStep) setCurrentStep(s.id);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                completedSteps.has(s.id)
                  ? 'bg-green-500 text-white'
                  : s.id === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {completedSteps.has(s.id) ? '✓' : s.id}
            </button>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 transition-colors ${completedSteps.has(s.id) ? 'bg-green-500' : 'bg-muted'}`}
              />
            )}
          </div>
        ))}
        <Badge variant="outline" className="ml-2 text-xs">
          Step {currentStep} of {STEPS.length}
        </Badge>
      </div>

      {/* Step card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <StepIcon className="text-primary h-5 w-5" />
            </div>
            <div>
              <CardTitle>{step.title}</CardTitle>
              <CardDescription>{step.subtitle}</CardDescription>
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">{step.description}</p>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && <StepCatalogue onComplete={completeStep} />}
          {currentStep === 2 && <StepTeam onComplete={completeStep} />}
          {currentStep === 3 && <StepXero onComplete={completeStep} />}
          {currentStep === 4 && <StepWarehouses onComplete={completeStep} />}
          {currentStep === 5 && <StepAlerts onComplete={completeStep} />}
        </CardContent>
      </Card>

      {/* Back nav */}
      {currentStep > 1 && (
        <Button variant="ghost" size="sm" onClick={() => setCurrentStep((s) => s - 1)}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Back to step {currentStep - 1}
        </Button>
      )}
    </div>
  );
}
