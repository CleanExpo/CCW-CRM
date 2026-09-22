'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  comparePhase2Area,
  getPhase2EvidenceUrl,
  getPhase2SameAnswer,
  getPhase2Scope,
} from '@/lib/api/phase2';
import {
  PHASE2_AREA_TITLES,
  PHASE2_AREAS,
  type Phase2Area,
  type Phase2AreaReport,
} from '@/lib/phase2/types';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type Phase2PanelProps = {
  isConnected: boolean;
};

type ScopePayload = {
  unsigned?: boolean;
  materiality?: { quantity_exact: boolean; dollar_figures: string };
  preflight?: Array<{ id: string; check: string; result: string }>;
  source_of_truth?: Array<{ area: number; cin7: string; optix: string }>;
  gates?: Array<{ area: number; allowed: boolean; reason: string | null }>;
  out_of_scope?: string[];
  phase1_missing?: number;
  price_lists_complete?: boolean;
};

export function Phase2Panel({ isConnected }: Phase2PanelProps) {
  const [area, setArea] = useState<Phase2Area>(1);
  const [report, setReport] = useState<Phase2AreaReport | null>(null);
  const [pack, setPack] = useState<Record<string, unknown> | null>(null);
  const [scope, setScope] = useState<ScopePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getPhase2Scope()
      .then((row) => setScope(row as ScopePayload))
      .catch(() => undefined);
  }, []);

  async function runCompare(next: Phase2Area) {
    setArea(next);
    setBusy(true);
    setError(null);
    try {
      setReport(await comparePhase2Area(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compare failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadPack() {
    setBusy(true);
    setError(null);
    try {
      setPack(await getPhase2SameAnswer());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pack failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Phase 2 · Area {area}</CardTitle>
        <CardDescription>
          v1.1 operational and financial reconciliation. Cin7 stays the source of truth. Compares
          are read-only. This document is not signed until Toby writes approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Order: Phase 1 close → complete stock → quantities → E2/E3 → valuation → price lists →
          invoices → COGS → balances → POs (sign after 2) → movements (sign after 4) → E5 → Xero.
        </p>
        {scope?.unsigned ? (
          <p className="text-xs">
            v1.1 is still a draft. Quantity match is exact. Dollar tiers are TBC.
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Phase 1 missing {scope?.phase1_missing ?? '—'} · price lists{' '}
          {scope?.price_lists_complete ? 'complete' : 'not complete'}
        </p>
        <div className="flex flex-wrap gap-2">
          {PHASE2_AREAS.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={n === area ? 'default' : 'outline'}
              disabled={!isConnected || busy}
              onClick={() => void runCompare(n)}
            >
              {n === 1 ? 'Compare on-hand quantities' : `Area ${n}`}
            </Button>
          ))}
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void loadPack()}>
            Same-answer pack
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={getPhase2EvidenceUrl(area)}>Export evidence</a>
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{PHASE2_AREA_TITLES[area]}</p>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {report ? <Phase2ReportView report={report} /> : null}
        {pack ? (
          <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
            {JSON.stringify(pack, null, 2)}
          </pre>
        ) : null}
        {scope?.preflight ? (
          <div>
            <p className="text-sm font-medium">E1–E8 pre-flight</p>
            <ul className="text-muted-foreground mt-1 list-disc space-y-1 pl-4 text-xs">
              {scope.preflight.map((row) => (
                <li key={row.id}>
                  {row.id} · {row.result} — {row.check}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {scope?.source_of_truth ? (
          <div>
            <p className="text-sm font-medium">Source of truth</p>
            <ul className="text-muted-foreground mt-1 space-y-1 text-xs">
              {scope.source_of_truth.map((row) => (
                <li key={row.area}>
                  Area {row.area}: Cin7 {row.cin7} · Optix {row.optix}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {scope?.out_of_scope ? (
          <p className="text-muted-foreground text-xs">
            Out of scope: {scope.out_of_scope.join('; ')}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Phase2ReportView({ report }: { report: Phase2AreaReport }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        As of {report.as_of}
        {report.blocked ? ' · blocked' : report.clean ? ' · clean' : ' · differences'}
        {report.blocked_reason ? ` — ${report.blocked_reason}` : ''}
      </p>
      <p className="tabular-nums">
        Company totals · Cin7 {report.company.cin7.toLocaleString()} · Optix{' '}
        {report.company.optix.toLocaleString()} · diff {report.company.difference.toLocaleString()}
      </p>
      <p className="tabular-nums">
        SKUs Cin7 {report.sku_count.cin7} / Optix {report.sku_count.optix} · warehouses Cin7{' '}
        {report.warehouse_count.cin7} / Optix {report.warehouse_count.optix}
      </p>
      <p className="tabular-nums">
        Missing {report.counts.missing} · extra {report.counts.extra} · quantity mismatches{' '}
        {report.counts.quantity_mismatch}
      </p>
      {report.warehouses.length > 0 ? (
        <ul className="text-muted-foreground space-y-0.5 text-xs tabular-nums">
          {report.warehouses.map((w) => (
            <li key={w.warehouse}>
              {w.warehouse}: Cin7 {w.cin7.toLocaleString()} · Optix {w.optix.toLocaleString()} ·
              diff {w.difference.toLocaleString()}
            </li>
          ))}
        </ul>
      ) : null}
      {report.sample.length > 0 ? (
        <ul className="space-y-1">
          {report.sample.map((row, i) => (
            <li key={`${row.sku}-${row.warehouse}-${i}`}>
              {row.sku ?? row.document ?? 'line'}
              {row.warehouse ? ` · ${row.warehouse}` : ''} · {row.classification} · diff{' '}
              {row.difference}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">No sample differences on this run.</p>
      )}
      <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs">
        {report.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
