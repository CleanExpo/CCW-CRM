import { describe, expect, it } from 'vitest';
import {
  extractCcwEvidenceFindings,
  summariseCcwEvidenceFindings,
} from '../evidence-standard';

describe('extractCcwEvidenceFindings', () => {
  it('extracts tagged claims with source URLs and review requirements', () => {
    const findings = extractCcwEvidenceFindings(`
- [VERIFIED] Seven Hills rent is materially lower than the Artarmon option. https://example.com/rent-note
- [INFERENCE] The AI phone agent should improve after-hours lead capture.
- [UNCONFIRMED] Assumption: new company days can create supplier-funded campaign opportunities. source: \`docs/company-days.md\`
Plain text without a tag should be ignored.
`);

    expect(findings).toHaveLength(3);
    expect(findings[0]).toMatchObject({
      tag: 'verified',
      finding_type: 'claim',
      source_label: 'example.com',
      review_required: false,
    });
    expect(findings[1]).toMatchObject({
      tag: 'inference',
      finding_type: 'claim',
      review_required: true,
    });
    expect(findings[2]).toMatchObject({
      tag: 'unconfirmed',
      finding_type: 'assumption',
      source_path: 'docs/company-days.md',
      review_required: true,
    });
  });

  it('summarises the evidence register for UI counts', () => {
    const findings = extractCcwEvidenceFindings(`
[VERIFIED] Xero-backed cost baseline exists.
[INFERENCE] Follow-up agents can reduce missed service interval revenue.
[UNCONFIRMED] Assumption: newsletter conversion will exceed current baseline.
`);

    expect(summariseCcwEvidenceFindings(findings)).toEqual({
      total: 3,
      review_required: 2,
      by_tag: {
        verified: 1,
        inference: 1,
        unconfirmed: 1,
      },
      by_type: {
        claim: 2,
        assumption: 1,
      },
    });
  });
});
