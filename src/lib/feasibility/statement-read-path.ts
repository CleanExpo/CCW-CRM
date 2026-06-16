import {
  extractCcwEvidenceFindings,
  summariseCcwEvidenceFindings,
  type CcwEvidenceFindingDraft,
} from './evidence-standard';

export type CcwFeasibilityStatementSeed = {
  title: string;
  objective: string;
  content_markdown?: string | null;
  parent_statement_id?: string | null;
};

export type CcwFeasibilityStatementExport = {
  id: string;
  title: string;
  objective: string;
  status: string;
  content_markdown: string | null;
  created_at: string;
  updated_at: string;
  parent_statement_id: string | null;
  findings: CcwEvidenceFindingDraft[];
};

function normaliseText(value: unknown, fallback = ''): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

export function normaliseCcwFeasibilityStatementSeed(
  input: Record<string, unknown>
): CcwFeasibilityStatementSeed {
  const title = normaliseText(input.title, 'Toby operating feasibility statement');
  const objective = normaliseText(
    input.objective,
    'Increase profitable customer access and sales conversion while protecting the Seven Hills cost advantage.'
  );
  const content = normaliseText(input.content_markdown ?? input.contentMarkdown);
  const parent = normaliseText(input.parent_statement_id ?? input.parentStatementId);

  return {
    title,
    objective,
    content_markdown: content || buildDefaultCcwFeasibilityMarkdown(title, objective),
    parent_statement_id: parent || null,
  };
}

export function buildDefaultCcwFeasibilityMarkdown(title: string, objective: string): string {
  return `# ${title}

Objective: ${objective}

- [VERIFIED] CCW needs the feasibility ally to protect the Seven Hills cost advantage while testing growth options.
- [INFERENCE] The first useful operating loop is a saved statement, scenario comparison, evidence register, and owner review queue.
- [UNCONFIRMED] Assumption: Xero account mappings for rent, staff cost, revenue, and margin still need Toby approval before claims can be treated as backed.

## Next Owner Decisions

- Confirm which Xero accounts or tracking categories back the planning claims.
- Confirm the first pilot scenario Toby wants measured.
- Confirm which phone-agent knowledge sources are approved for customer-facing answers.
`;
}

export function findingsPayloadFromMarkdown(markdown: string) {
  const findings = extractCcwEvidenceFindings(markdown);
  return {
    findings,
    summary: summariseCcwEvidenceFindings(findings),
  };
}

export function buildCcwFeasibilityMarkdownExport(input: CcwFeasibilityStatementExport): string {
  const evidenceSummary = summariseCcwEvidenceFindings(input.findings);
  const findingLines = input.findings.length
    ? input.findings
        .map((finding) => {
          const source = finding.source_url || finding.source_path || finding.source_label;
          return `- [${finding.tag.toUpperCase()}] ${finding.claim}${source ? ` (source: ${source})` : ''}`;
        })
        .join('\n')
    : '- No tagged findings have been extracted yet.';

  const lineage = input.parent_statement_id
    ? `Parent statement: ${input.parent_statement_id}`
    : 'Parent statement: none';

  return `# ${input.title}

Status: ${input.status}
Statement ID: ${input.id}
${lineage}
Created: ${input.created_at}
Updated: ${input.updated_at}

## Objective

${input.objective}

## Statement

${input.content_markdown || '_No statement body recorded._'}

## Evidence Findings Summary

- Total findings: ${evidenceSummary.total}
- Review required: ${evidenceSummary.review_required}
- Verified: ${evidenceSummary.by_tag.verified}
- Inference: ${evidenceSummary.by_tag.inference}
- Unconfirmed: ${evidenceSummary.by_tag.unconfirmed}
- Assumptions: ${evidenceSummary.by_type.assumption}

## Findings And Assumptions

${findingLines}
`;
}
