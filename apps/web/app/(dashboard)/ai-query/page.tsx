'use client';

import { useState } from 'react';
import { ChevronRight, Database, MessageSquare, Search, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────

interface QueryResult {
  query: string;
  sql: string | null;
  results: Record<string, unknown>[];
  answer: string;
  confidence: number;
  row_count: number;
}

interface ExamplesResponse {
  examples: {
    category: string;
    queries: string[];
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const colour = pct >= 90 ? 'text-green-700' : pct >= 75 ? 'text-amber-700' : 'text-red-700';
  return <span className={`text-xs font-medium ${colour}`}>{pct}% confidence</span>;
}

function ResultsTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="text-muted-foreground text-sm">No rows returned.</p>;
  const headers = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30 border-t">
              {headers.map((h) => (
                <td key={h} className="px-3 py-2">
                  {String(row[h] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function AIQueryPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [examples, setExamples] = useState<ExamplesResponse | null>(null);
  const [showSQL, setShowSQL] = useState(false);
  const [history, setHistory] = useState<QueryResult[]>([]);

  async function handleQuery(q?: string) {
    const text = q ?? query;
    if (!text.trim()) return;
    setLoading(true);
    setQuery(text);
    try {
      const res = await apiClient.post<QueryResult>('/api/ai/query', {
        query: text,
      });
      setResult(res);
      setHistory((prev) => [res, ...prev].slice(0, 10));
      setShowSQL(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Query failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function loadExamples() {
    if (examples) return;
    try {
      const res = await apiClient.get<ExamplesResponse>('/api/ai/query/examples');
      setExamples(res);
    } catch {
      /* silently ignore */
    }
  }

  return (
    <div className="flex h-full flex-col space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI ERP Query</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ask questions in plain English — Claude converts them to SQL and explains the results.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            placeholder='e.g. "How many truckmounts do we have?" or "Which customers haven&apos;t ordered in 90 days?"'
            className="pl-10"
          />
        </div>
        <Button onClick={() => handleQuery()} disabled={loading || !query.trim()}>
          <Sparkles className="mr-2 h-4 w-4" />
          {loading ? 'Thinking...' : 'Ask'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main result */}
        <div className="space-y-4 lg:col-span-2">
          {result ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    <MessageSquare className="text-primary mr-2 inline h-4 w-4" />
                    Answer
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <ConfidencePill value={result.confidence} />
                    <Badge variant="outline">{result.row_count} rows</Badge>
                  </div>
                </div>
                <CardDescription className="text-sm italic">
                  &quot;{result.query}&quot;
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Natural language answer */}
                <p className="text-sm leading-relaxed">{result.answer}</p>

                {/* SQL toggle */}
                {result.sql && (
                  <div>
                    <button
                      onClick={() => setShowSQL((v) => !v)}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                    >
                      <Database className="h-3 w-3" />
                      {showSQL ? 'Hide SQL' : 'Show SQL'}
                      <ChevronRight
                        className={`h-3 w-3 transition-transform ${showSQL ? 'rotate-90' : ''}`}
                      />
                    </button>
                    {showSQL && (
                      <pre className="bg-muted mt-2 overflow-x-auto rounded p-3 text-xs">
                        {result.sql}
                      </pre>
                    )}
                  </div>
                )}

                {/* Results table */}
                {result.results.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      Data
                    </p>
                    <ResultsTable rows={result.results} />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <MessageSquare className="text-muted-foreground/40 mb-4 h-12 w-12" />
                <h3 className="font-semibold">Ask your ERP anything</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Type a question above or pick an example from the right.
                </p>
              </CardContent>
            </Card>
          )}

          {/* History */}
          {history.length > 1 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Recent queries
              </p>
              {history.slice(1, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleQuery(h.query)}
                  className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm"
                >
                  <span className="text-muted-foreground truncate">{h.query}</span>
                  <ChevronRight className="text-muted-foreground ml-2 h-3 w-3 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Examples sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Example Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!examples ? (
                <Button variant="ghost" size="sm" className="w-full" onClick={loadExamples}>
                  Load examples
                </Button>
              ) : (
                examples.examples.map((cat) => (
                  <div key={cat.category} className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {cat.category}
                    </p>
                    {cat.queries.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQuery(q)}
                        className="hover:bg-muted/50 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs"
                      >
                        <ChevronRight className="text-primary mt-0.5 h-3 w-3 shrink-0" />
                        {q}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
