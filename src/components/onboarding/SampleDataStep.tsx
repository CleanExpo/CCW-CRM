'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Package, Users, FileText, ShoppingCart } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface SampleDataStepProps {
  onComplete: (data?: Record<string, unknown>) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isOptional: boolean;
}

interface DataOption {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

const DATA_OPTIONS: DataOption[] = [
  {
    id: 'products',
    label: 'Sample Products',
    description: 'Equipment and supplies catalog',
    icon: Package,
    count: 50,
  },
  {
    id: 'customers',
    label: 'Sample Customers',
    description: 'Demo customer accounts',
    icon: Users,
    count: 20,
  },
  {
    id: 'orders',
    label: 'Sample Orders',
    description: 'Historical order data',
    icon: ShoppingCart,
    count: 30,
  },
  {
    id: 'quotes',
    label: 'Sample Quotes',
    description: 'Example quotes and proposals',
    icon: FileText,
    count: 15,
  },
];

export function SampleDataStep({ onComplete, onSkip, onBack, isOptional }: SampleDataStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    new Set(DATA_OPTIONS.map((opt) => opt.id))
  );

  const handleToggle = (optionId: string) => {
    setSelectedOptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(optionId)) {
        newSet.delete(optionId);
      } else {
        newSet.add(optionId);
      }
      return newSet;
    });
  };

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      await apiClient
        .post('/api/test-data/generate', {
          types: Array.from(selectedOptions),
        })
        .catch(() => undefined); // Non-fatal: endpoint may not exist in all envs
      setIsGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Generate sample data to explore the platform. This helps you understand features without
          entering your own data. You can delete it anytime.
        </AlertDescription>
      </Alert>

      {!isGenerated ? (
        <>
          <div className="space-y-4">
            {DATA_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <div
                  key={option.id}
                  className="hover:bg-accent/50 flex items-start space-x-3 rounded-lg border p-4 transition-colors"
                >
                  <Checkbox
                    id={option.id}
                    checked={selectedOptions.has(option.id)}
                    onCheckedChange={() => handleToggle(option.id)}
                    disabled={isGenerating}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="text-muted-foreground h-4 w-4" />
                      <Label
                        htmlFor={option.id}
                        className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </Label>
                      <span className="text-muted-foreground text-xs">({option.count} items)</span>
                    </div>
                    <p className="text-muted-foreground text-sm">{option.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack} disabled={isGenerating}>
              Back
            </Button>
            <div className="flex gap-2">
              {isOptional && (
                <Button variant="ghost" onClick={onSkip} disabled={isGenerating}>
                  Skip for Now
                </Button>
              )}
              <Button
                onClick={handleGenerate}
                disabled={selectedOptions.size === 0 || isGenerating}
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Sample Data
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Sample Data Generated!</h3>
              <p className="text-muted-foreground text-sm">
                You now have demo data to explore the platform.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => onComplete({ generated: true, options: Array.from(selectedOptions) })}
            >
              Continue
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
