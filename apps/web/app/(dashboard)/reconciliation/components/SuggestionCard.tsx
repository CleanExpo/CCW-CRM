'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, AlertTriangle, CreditCard } from 'lucide-react';

interface Suggestion {
  pos_transaction_id: string;
  transaction_number: string;
  amount: number;
  date: string;
  payment_method: string;
  confidence: number;
  match_reasons: string[];
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  feedAmount: number;
  isSelected: boolean;
  onSelect: () => void;
}

export function SuggestionCard({
  suggestion,
  feedAmount,
  isSelected,
  onSelect,
}: SuggestionCardProps) {
  const confidencePercent = (suggestion.confidence * 100).toFixed(0);
  const amountDiff = Math.abs(suggestion.amount - feedAmount);

  // Determine confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 0.8) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 0.9) return 'default';
    if (confidence >= 0.8) return 'secondary';
    return 'outline';
  };

  return (
    <Card
      className={`cursor-pointer p-4 transition-colors ${
        isSelected ? 'ring-primary bg-primary/5 ring-2' : 'hover:bg-muted/50'
      }`}
      onClick={onSelect}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
            />
            <div>
              <div className="text-sm font-medium">{suggestion.transaction_number}</div>
              <div className="text-muted-foreground text-xs">{formatDate(suggestion.date)}</div>
            </div>
          </div>
          <Badge variant={getConfidenceBadgeVariant(suggestion.confidence)}>
            {confidencePercent}% match
          </Badge>
        </div>

        {/* Amount */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">${suggestion.amount.toFixed(2)}</div>
          {amountDiff > 0 && amountDiff < 1 && (
            <Badge variant="outline" className="text-xs">
              ±${amountDiff.toFixed(2)}
            </Badge>
          )}
        </div>

        {/* Payment Method */}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4" />
          <span className="capitalize">{suggestion.payment_method}</span>
        </div>

        {/* Match Reasons */}
        <div className="space-y-1">
          {suggestion.match_reasons.slice(0, 3).map((reason, index) => (
            <div key={index} className="text-muted-foreground flex items-start gap-2 text-xs">
              {index === 0 && suggestion.confidence >= 0.9 ? (
                <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600" />
              ) : (
                <span className="bg-muted mt-0.5 h-3 w-3 flex-shrink-0 rounded-full" />
              )}
              <span>{reason}</span>
            </div>
          ))}
          {suggestion.match_reasons.length > 3 && (
            <div className="text-muted-foreground pl-5 text-xs">
              +{suggestion.match_reasons.length - 3} more reasons
            </div>
          )}
        </div>

        {/* Warning for low confidence */}
        {suggestion.confidence < 0.7 && (
          <div className="flex items-center gap-2 rounded bg-orange-50 p-2 text-xs text-orange-600">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>Moderate confidence - review recommended</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
