'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Tag, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';

interface PersonaRecord {
  customer_id: string;
  company_name: string;
  persona: string;
  confidence: string;
  reason: string;
  classified_at: string | null;
}

interface PersonasResponse {
  items: PersonaRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: Record<string, number>;
}

const PERSONA_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; description: string }
> = {
  high_value: {
    label: 'High Value',
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-900',
    description: 'Lifetime spend ≥ $10,000',
  },
  equipment_buyer: {
    label: 'Equipment Buyer',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900',
    description: 'Avg item price ≥ $1,000',
  },
  consumables: {
    label: 'Consumables',
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900',
    description: 'Frequent orders, low value',
  },
  contractor: {
    label: 'Contractor',
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-900',
    description: '2–4 orders, project-based',
  },
  new_account: {
    label: 'New Account',
    color: 'text-teal-600',
    bg: 'bg-teal-50 border-teal-200 dark:bg-teal-950 dark:border-teal-900',
    description: 'Created within last 30 days',
  },
  dormant: {
    label: 'Dormant',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900',
    description: 'No order in 90+ days',
  },
  unclassified: {
    label: 'Unclassified',
    color: 'text-muted-foreground',
    bg: 'bg-muted border',
    description: 'Insufficient data',
  },
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'text-green-600',
  medium: 'text-amber-600',
  low: 'text-red-600',
};

export default function PersonasPage() {
  const { toast } = useToast();
  const [data, setData] = useState<PersonasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [personaFilter, setPersonaFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        personaFilter !== 'all'
          ? `?persona_filter=${personaFilter}&page_size=200`
          : '?page_size=200';
      const res = await apiClient.get<PersonasResponse>(`/api/crm/personas${params}`);
      setData(res);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load personas',
      });
    } finally {
      setLoading(false);
    }
  }, [personaFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClassifyAll = async () => {
    setClassifying(true);
    try {
      const res = await apiClient.post<{ classified: number; summary: Record<string, number> }>(
        '/api/crm/personas/classify-all',
        {}
      );
      toast({
        title: 'Classification complete',
        description: `${res.classified} customers classified.`,
      });
      load();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Classification failed',
      });
    } finally {
      setClassifying(false);
    }
  };

  const summary = data?.summary ?? {};
  const summaryEntries = Object.entries(PERSONA_CONFIG).filter(([key]) => key !== 'unclassified');

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <Tag className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customer Personas</h1>
            <p className="text-muted-foreground text-sm">
              Auto-classification by behaviour using order data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleClassifyAll} disabled={classifying || loading}>
            <Zap className="mr-2 h-4 w-4" />
            {classifying ? 'Classifying...' : 'Re-classify All'}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))
          : summaryEntries.map(([key, cfg]) => (
              <Card
                key={key}
                className={`border ${cfg.bg} cursor-pointer transition-shadow hover:shadow-md`}
                onClick={() => setPersonaFilter(key === personaFilter ? 'all' : key)}
              >
                <CardHeader className="px-4 pt-4 pb-1">
                  <CardDescription className={`text-xs ${cfg.color}`}>{cfg.label}</CardDescription>
                  <CardTitle className={`text-2xl ${cfg.color}`}>{summary[key] ?? 0}</CardTitle>
                </CardHeader>
              </Card>
            ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={personaFilter} onValueChange={setPersonaFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by persona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All personas</SelectItem>
            {Object.entries(PERSONA_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">{data?.total ?? 0} customers</span>
        {personaFilter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setPersonaFilter('all')}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="px-4 py-3 text-center font-medium">Persona</th>
                  <th className="px-4 py-3 text-center font-medium">Confidence</th>
                  <th className="px-4 py-3 text-left font-medium">Reason</th>
                  <th className="px-4 py-3 text-center font-medium">Classified</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground px-4 py-12 text-center">
                      No persona records found. Click &quot;Re-classify All&quot; to generate.
                    </td>
                  </tr>
                ) : (
                  data?.items.map((row) => {
                    const cfg = PERSONA_CONFIG[row.persona] ?? PERSONA_CONFIG.unclassified;
                    return (
                      <tr
                        key={row.customer_id}
                        className="hover:bg-muted/30 border-b transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">{row.company_name}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className={`border ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                        </td>
                        <td
                          className={`px-4 py-3 text-center font-medium capitalize ${CONFIDENCE_COLOR[row.confidence] ?? ''}`}
                        >
                          {row.confidence}
                        </td>
                        <td
                          className="text-muted-foreground max-w-64 truncate px-4 py-3 text-xs"
                          title={row.reason}
                        >
                          {row.reason}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-center text-xs">
                          {row.classified_at
                            ? new Date(row.classified_at).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
