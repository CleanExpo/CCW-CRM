import { describe, expect, it } from 'vitest';
import {
  buildCcwFeasibilityMarkdownExport,
  findingsPayloadFromMarkdown,
  normaliseCcwFeasibilityStatementSeed,
} from '../statement-read-path';

describe('normaliseCcwFeasibilityStatementSeed', () => {
  it('creates a usable default statement when input is sparse', () => {
    const seed = normaliseCcwFeasibilityStatementSeed({});

    expect(seed.title).toBe('Toby operating feasibility statement');
    expect(seed.objective).toContain('Seven Hills');
    expect(seed.content_markdown).toContain('[VERIFIED]');
    expect(seed.parent_statement_id).toBeNull();
  });

  it('preserves parent linkage for refinement create paths', () => {
    const seed = normaliseCcwFeasibilityStatementSeed({
      title: 'Artarmon branch check',
      objective: 'Measure Artarmon before committing rent.',
      parent_statement_id: 'f8cd908e-3ea1-4754-9018-4976220d4a33',
      content_markdown: '- [UNCONFIRMED] Assumption: demand is high enough.',
    });

    expect(seed.title).toBe('Artarmon branch check');
    expect(seed.parent_statement_id).toBe('f8cd908e-3ea1-4754-9018-4976220d4a33');
  });
});

describe('findingsPayloadFromMarkdown', () => {
  it('returns findings and summary for database writes', () => {
    const payload = findingsPayloadFromMarkdown(`
- [VERIFIED] Seven Hills baseline is the current comparison point.
- [UNCONFIRMED] Assumption: phone agent conversion will cover pilot cost.
`);

    expect(payload.findings).toHaveLength(2);
    expect(payload.summary.total).toBe(2);
    expect(payload.summary.review_required).toBe(1);
    expect(payload.summary.by_type.assumption).toBe(1);
  });
});

describe('buildCcwFeasibilityMarkdownExport', () => {
  it('includes lineage and evidence summary in the downloaded markdown', () => {
    const markdown = buildCcwFeasibilityMarkdownExport({
      id: 'statement-1',
      title: 'Toby operating feasibility statement',
      objective: 'Protect Seven Hills while testing growth.',
      status: 'draft',
      content_markdown: '## Body',
      created_at: '2026-06-16T00:00:00.000Z',
      updated_at: '2026-06-16T01:00:00.000Z',
      parent_statement_id: 'parent-1',
      findings: [
        {
          finding_type: 'claim',
          tag: 'verified',
          claim: 'Seven Hills is the baseline.',
          source_label: 'Owner input',
          source_url: null,
          source_path: null,
          review_required: false,
        },
      ],
    });

    expect(markdown).toContain('Parent statement: parent-1');
    expect(markdown).toContain('Total findings: 1');
    expect(markdown).toContain('[VERIFIED] Seven Hills is the baseline.');
  });
});
