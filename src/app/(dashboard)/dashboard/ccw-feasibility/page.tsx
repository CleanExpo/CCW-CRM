'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Download,
  FileText,
  GitBranch,
  ListRestart,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';

type StatementListItem = {
  id: string;
  title: string;
  objective: string;
  status: string;
  parent_statement_id: string | null;
  parent_title: string | null;
  updated_at: string;
  counts: {
    children: number;
    scenarios: number;
    findings: number;
    financial_claims: number;
    opportunities: number;
  };
};

type StatementDetail = StatementListItem & {
  content_markdown: string | null;
  evidence_summary: {
    total?: number;
    review_required?: number;
    by_tag?: Record<string, number>;
    by_type?: Record<string, number>;
  };
  parent: { id: string; title: string; created_at: string } | null;
  children: Array<{ id: string; title: string; status: string; created_at: string; updated_at: string }>;
  scenarios: Array<{
    id: string;
    scenario_code: string;
    scenario_name: string;
    status: string;
    recommendation: string | null;
    weighted_feasibility_score: number | null;
    required_extra_monthly_contribution_aud: number | null;
    parent_scenario_id: string | null;
    updated_at: string;
  }>;
  financial_claims: Array<{
    id: string;
    claim_type: string;
    label: string;
    value_aud: number | null;
    state: string;
    source_system: string;
    xero_account_code: string | null;
    backed_at: string | null;
  }>;
  findings: Array<{
    id: string;
    finding_type: string;
    tag: string;
    claim: string;
    source_label: string | null;
    source_url: string | null;
    source_path: string | null;
    status: string;
    review_required: boolean;
    created_at: string;
  }>;
  opportunities: Array<{
    id: string;
    title: string;
    opportunity_type: string;
    status: string;
    description: string | null;
    expected_benefit?: {
      expected_value_aud?: number;
      priority_score?: number;
      effort_score?: number;
      risk_score?: number;
      evidence_score?: number;
    };
    decision_gate?: string | null;
    measurements?: Array<{
      id: string;
      metric_name: string;
      metric_value: number | null;
      unit: string | null;
      source_system: string;
      measured_at: string;
    }>;
  }>;
  created_at: string;
};

type ListResponse = {
  items: StatementListItem[];
  total: number;
};

const API_BASE = '/api/addons/ccw-feasibility-ai/statements';

const DEFAULT_OBJECTIVE =
  'Increase profitable customer access and sales conversion while protecting the Seven Hills cost advantage.';

const DEFAULT_BODY = `# Toby operating feasibility statement

Objective: ${DEFAULT_OBJECTIVE}

- [VERIFIED] CCW needs a living feasibility ally for growth, diversification, and cost-saving decisions.
- [INFERENCE] The first useful production loop is saving a statement, reopening it, reviewing findings, and measuring scenarios.
- [UNCONFIRMED] Assumption: Xero mappings for rent, staff cost, revenue, and margin still need Toby approval before numbers are treated as backed.

## Immediate Production Questions

- Which Xero accounts back Seven Hills rent and NSW staff cost?
- Which pilot scenario should be measured first?
- Which CCW knowledge sources are approved for phone-agent answers?
`;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function money(value: number | null) {
  if (value == null) return 'Not set';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function badgeVariant(tag: string) {
  if (tag === 'verified' || tag === 'keep' || tag === 'pilot') return 'success' as const;
  if (tag === 'unconfirmed' || tag === 'defer') return 'pending' as const;
  if (tag === 'reject' || tag === 'disputed') return 'destructive' as const;
  return 'outline' as const;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === 'string' ? body.detail : 'Request failed';
    throw new Error(message);
  }
  return body as T;
}

export default function CcwFeasibilityDashboardPage() {
  const [items, setItems] = useState<StatementListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [title, setTitle] = useState('Toby operating feasibility statement');
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE);
  const [content, setContent] = useState(DEFAULT_BODY);
  const [scenarioName, setScenarioName] = useState('Seven Hills + AI phone pilot');
  const [expectedMargin, setExpectedMargin] = useState('30000');
  const [claimLabel, setClaimLabel] = useState('Seven Hills annual occupancy cost');
  const [claimValue, setClaimValue] = useState('165000');
  const [claimState, setClaimState] = useState('owner_entered');
  const [claimSourceReference, setClaimSourceReference] = useState('');
  const [opportunityTitle, setOpportunityTitle] = useState('After-hours AI phone lead capture');
  const [opportunityType, setOpportunityType] = useState('growth');
  const [opportunityValue, setOpportunityValue] = useState('85000');
  const [opportunityEvidenceScore, setOpportunityEvidenceScore] = useState('55');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFindings = useMemo(() => detail?.findings ?? [], [detail?.findings]);
  const assumptions = useMemo(
    () => selectedFindings.filter((finding) => finding.finding_type === 'assumption'),
    [selectedFindings]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readJson<ListResponse>(await fetch(API_BASE, { cache: 'no-store' }));
      setItems(data.items);
      if (!selectedId && data.items[0]) {
        setSelectedId(data.items[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await readJson<StatementDetail>(await fetch(`${API_BASE}/${id}`, { cache: 'no-store' }));
      setDetail(data);
      setTitle(data.title);
      setObjective(data.objective);
      setContent(data.content_markdown ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function createStatement() {
    setSaving(true);
    setError(null);
    try {
      const created = await readJson<StatementListItem>(
        await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, objective, content_markdown: content }),
        })
      );
      await loadList();
      setSelectedId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveStatement() {
    if (!detail) return createStatement();
    setSaving(true);
    setError(null);
    try {
      const updated = await readJson<StatementDetail>(
        await fetch(`${API_BASE}/${detail.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, objective, content_markdown: content }),
        })
      );
      setDetail(updated);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function refineStatement() {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      const refined = await readJson<{ id: string }>(
        await fetch(`${API_BASE}/${detail.id}/refine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refinement_note: 'Next version for Toby review after the latest production pass.',
          }),
        })
      );
      await loadList();
      setSelectedId(refined.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addScenario() {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      await readJson(
        await fetch(`${API_BASE}/${detail.id}/scenarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario_name: scenarioName,
            annual_rent_aud: 60000,
            annual_staff_cost_aud: 105000,
            annual_outgoings_aud: 5000,
            one_off_fitout_aud: 10000,
            expected_incremental_margin_aud: Number(expectedMargin),
            baseline_annual_cost_aud: 165000,
            strategic_score: 90,
            risk_score: 35,
          }),
        })
      );
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addFinancialClaim() {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      await readJson(
        await fetch(`${API_BASE}/${detail.id}/financial-claims`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim_type: 'operating_claim',
            label: claimLabel,
            value_aud: Number(claimValue),
            state: claimState,
            source_system: claimState === 'xero_backed' ? 'xero' : 'manual',
            source_reference: claimSourceReference,
          }),
        })
      );
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addOpportunity() {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      await readJson(
        await fetch(`${API_BASE}/${detail.id}/opportunities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: opportunityTitle,
            opportunity_type: opportunityType,
            expected_value_aud: Number(opportunityValue),
            effort_score: 45,
            risk_score: 35,
            evidence_score: Number(opportunityEvidenceScore),
          }),
        })
      );
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function exportMarkdown() {
    if (!detail) return;
    const response = await fetch(`${API_BASE}/${detail.id}/export`, { cache: 'no-store' });
    if (!response.ok) {
      setError('Export failed');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${detail.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'ccw-feasibility'}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-muted-foreground" aria-hidden />
            <h1 className="text-3xl font-bold tracking-tight">CCW Feasibility Ally</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Persistent operating statements, evidence findings, scenario measurement, and refinement lineage for Toby.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadList} disabled={loading} leftIcon={<RefreshCw />}>
            Refresh
          </Button>
          <Button onClick={createStatement} disabled={saving} leftIcon={<Plus />}>
            New
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved Statements</CardTitle>
            <CardDescription>{items.length} database-backed records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No saved feasibility statements yet.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-md border p-3 text-left text-sm transition hover:bg-muted/50 ${
                    selectedId === item.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant={badgeVariant(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.objective}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{item.counts.findings} findings</span>
                    <span>{item.counts.scenarios} scenarios</span>
                    <span>{item.counts.financial_claims} claims</span>
                    <span>{item.counts.opportunities} opportunities</span>
                    <span>{item.counts.children} refinements</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Updated {formatDate(item.updated_at)}</div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{detail ? 'Open Statement' : 'Draft Statement'}</CardTitle>
                  <CardDescription>
                    {detail ? `Opened from database: ${detail.id}` : 'Create the first persistent record'}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportMarkdown} disabled={!detail} leftIcon={<Download />}>
                    Export
                  </Button>
                  <Button variant="outline" onClick={refineStatement} disabled={!detail || saving} leftIcon={<GitBranch />}>
                    Refine
                  </Button>
                  <Button onClick={saveStatement} disabled={saving} leftIcon={<Save />}>
                    Save
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objective">Objective</Label>
                  <Input id="objective" value={objective} onChange={(event) => setObjective(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Statement Markdown</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="min-h-[280px] font-mono text-xs leading-relaxed"
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="findings" className="space-y-4">
            <TabsList>
              <TabsTrigger value="findings">Findings</TabsTrigger>
              <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
              <TabsTrigger value="claims">Claims</TabsTrigger>
              <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
              <TabsTrigger value="lineage">Lineage</TabsTrigger>
            </TabsList>

            <TabsContent value="findings">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evidence Register</CardTitle>
                  <CardDescription>
                    {selectedFindings.length} extracted findings, {assumptions.length} assumptions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFindings.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Save a statement with evidence tags to populate findings.
                    </div>
                  ) : (
                    selectedFindings.map((finding) => (
                      <div key={finding.id} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={badgeVariant(finding.tag)}>{finding.tag}</Badge>
                          <Badge variant="outline">{finding.finding_type}</Badge>
                          {finding.review_required ? <Badge variant="pending">review</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed">{finding.claim}</p>
                        {finding.source_url || finding.source_path || finding.source_label ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Source: {finding.source_url || finding.source_path || finding.source_label}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scenarios">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scenario Measurement</CardTitle>
                  <CardDescription>Save and reopen scored feasibility scenarios.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="scenario-name">Scenario</Label>
                      <Input
                        id="scenario-name"
                        value={scenarioName}
                        onChange={(event) => setScenarioName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expected-margin">Margin AUD</Label>
                      <Input
                        id="expected-margin"
                        inputMode="numeric"
                        value={expectedMargin}
                        onChange={(event) => setExpectedMargin(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={addScenario} disabled={!detail || saving} leftIcon={<Plus />}>
                        Add
                      </Button>
                    </div>
                  </div>

                  {(detail?.scenarios ?? []).length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No scenarios saved against this statement yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {detail?.scenarios.map((scenario) => (
                        <div key={scenario.id} className="rounded-md border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-medium">{scenario.scenario_name}</h3>
                              <p className="mt-1 text-xs text-muted-foreground">{scenario.scenario_code}</p>
                            </div>
                            <Badge variant={badgeVariant(scenario.recommendation ?? '')}>
                              {scenario.recommendation ?? 'unscored'}
                            </Badge>
                          </div>
                          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <dt className="text-muted-foreground">Score</dt>
                              <dd className="font-medium">{scenario.weighted_feasibility_score ?? 'Not set'}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Monthly contribution</dt>
                              <dd className="font-medium">
                                {money(scenario.required_extra_monthly_contribution_aud)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="claims">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Owner-Adjustable Claims</CardTitle>
                  <CardDescription>
                    Capture planning numbers Toby can adjust, then back with Xero evidence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_150px_160px_1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="claim-label">Claim</Label>
                      <Input id="claim-label" value={claimLabel} onChange={(event) => setClaimLabel(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="claim-value">Value AUD</Label>
                      <Input
                        id="claim-value"
                        inputMode="decimal"
                        value={claimValue}
                        onChange={(event) => setClaimValue(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="claim-state">State</Label>
                      <select
                        id="claim-state"
                        value={claimState}
                        onChange={(event) => setClaimState(event.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="owner_entered">Owner entered</option>
                        <option value="toby_adjusted">Toby adjusted</option>
                        <option value="xero_backed">Xero backed</option>
                        <option value="disputed">Disputed</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="claim-source">Source reference</Label>
                      <Input
                        id="claim-source"
                        placeholder="xero:ProfitAndLoss:2026"
                        value={claimSourceReference}
                        onChange={(event) => setClaimSourceReference(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={addFinancialClaim} disabled={!detail || saving} leftIcon={<Plus />}>
                        Add
                      </Button>
                    </div>
                  </div>

                  {(detail?.financial_claims ?? []).length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No financial claims saved against this statement yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {detail?.financial_claims.map((claim) => (
                        <div key={claim.id} className="rounded-md border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-medium">{claim.label}</h3>
                              <p className="mt-1 text-xs text-muted-foreground">{claim.claim_type}</p>
                            </div>
                            <Badge variant={badgeVariant(claim.state)}>{claim.state}</Badge>
                          </div>
                          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <dt className="text-muted-foreground">Value</dt>
                              <dd className="font-medium">{money(claim.value_aud)}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Source</dt>
                              <dd className="font-medium">{claim.source_system}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Xero account</dt>
                              <dd className="font-medium">{claim.xero_account_code ?? 'Not mapped'}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Backed</dt>
                              <dd className="font-medium">{claim.backed_at ? formatDate(claim.backed_at) : 'Not yet'}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="opportunities">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Growth And Savings Queue</CardTitle>
                  <CardDescription>
                    Rank growth, diversity, cost-saving, and risk-reduction opportunities for Toby.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_180px_150px_150px_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="opportunity-title">Opportunity</Label>
                      <Input
                        id="opportunity-title"
                        value={opportunityTitle}
                        onChange={(event) => setOpportunityTitle(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="opportunity-type">Type</Label>
                      <select
                        id="opportunity-type"
                        value={opportunityType}
                        onChange={(event) => setOpportunityType(event.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="growth">Growth</option>
                        <option value="diversification">Diversification</option>
                        <option value="cost_saving">Cost saving</option>
                        <option value="risk_reduction">Risk reduction</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="opportunity-value">Value AUD</Label>
                      <Input
                        id="opportunity-value"
                        inputMode="decimal"
                        value={opportunityValue}
                        onChange={(event) => setOpportunityValue(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="opportunity-evidence">Evidence score</Label>
                      <Input
                        id="opportunity-evidence"
                        inputMode="numeric"
                        value={opportunityEvidenceScore}
                        onChange={(event) => setOpportunityEvidenceScore(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={addOpportunity} disabled={!detail || saving} leftIcon={<Plus />}>
                        Add
                      </Button>
                    </div>
                  </div>

                  {(detail?.opportunities ?? []).length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No opportunities saved against this statement yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {detail?.opportunities.map((opportunity) => {
                        const priority =
                          opportunity.expected_benefit?.priority_score ??
                          opportunity.measurements?.find((item) => item.metric_name === 'priority_score')?.metric_value ??
                          null;

                        return (
                          <div key={opportunity.id} className="rounded-md border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-medium">{opportunity.title}</h3>
                                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  <TrendingUp className="h-3.5 w-3.5" />
                                  {opportunity.opportunity_type}
                                </p>
                              </div>
                              <Badge variant={badgeVariant(opportunity.status)}>{opportunity.status}</Badge>
                            </div>
                            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <dt className="text-muted-foreground">Priority</dt>
                                <dd className="flex items-center gap-1 font-medium">
                                  <Target className="h-4 w-4 text-muted-foreground" />
                                  {priority ?? 'Not scored'}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Expected value</dt>
                                <dd className="font-medium">
                                  {money(opportunity.expected_benefit?.expected_value_aud ?? null)}
                                </dd>
                              </div>
                            </dl>
                            {opportunity.decision_gate ? (
                              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                                Gate: {opportunity.decision_gate}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lineage">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Version Chain</CardTitle>
                  <CardDescription>Parent and child statements stay linked after refresh.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detail?.parent ? (
                    <div className="rounded-md border p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ListRestart className="h-4 w-4" />
                        Parent: {detail.parent.title}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{detail.parent.id}</p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      This is a root statement.
                    </div>
                  )}

                  {(detail?.children ?? []).map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setSelectedId(child.id)}
                      className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <FileText className="h-4 w-4" />
                        {child.title}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {child.status} · created {formatDate(child.created_at)}
                      </p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
