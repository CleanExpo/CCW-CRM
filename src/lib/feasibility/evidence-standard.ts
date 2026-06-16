export type CcwEvidenceTag = 'verified' | 'inference' | 'unconfirmed';
export type CcwFindingType = 'claim' | 'assumption';

export type CcwEvidenceFindingDraft = {
  finding_type: CcwFindingType;
  tag: CcwEvidenceTag;
  claim: string;
  source_label: string | null;
  source_url: string | null;
  source_path: string | null;
  review_required: boolean;
};

const TAG_PATTERN = /\[(VERIFIED|INFERENCE|UNCONFIRMED)\]/i;
const URL_PATTERN = /https?:\/\/[^\s)\]]+/i;
const PATH_PATTERN = /(?:^|\s)(?:source|file|path):\s*`?([^`\s]+)`?/i;
const ASSUMPTION_PATTERN = /\b(assumption|assume|assuming|expected|target|hypothesis)\b/i;
const MAX_CLAIM_LENGTH = 1200;

function normalizeTag(value: string): CcwEvidenceTag {
  const tag = value.trim().toLowerCase();
  if (tag === 'verified') return 'verified';
  if (tag === 'inference') return 'inference';
  return 'unconfirmed';
}

function cleanClaim(line: string): string {
  return line
    .replace(/^[-*]\s+/, '')
    .replace(TAG_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CLAIM_LENGTH);
}

function extractSourcePath(line: string): string | null {
  const explicit = line.match(PATH_PATTERN)?.[1]?.trim();
  if (explicit) return explicit;

  const backtickPath = line.match(/`([^`]+\.(?:md|sql|ts|tsx|json|yaml|yml|prisma))`/i)?.[1]?.trim();
  return backtickPath || null;
}

function extractSourceLabel(line: string, sourceUrl: string | null, sourcePath: string | null): string | null {
  if (sourceUrl) {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return sourceUrl;
    }
  }

  if (sourcePath) return sourcePath.split('/').pop() || sourcePath;
  return null;
}

export function extractCcwEvidenceFindings(markdown: string): CcwEvidenceFindingDraft[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => TAG_PATTERN.test(line))
    .map((line) => {
      const tag = normalizeTag(line.match(TAG_PATTERN)?.[1] ?? 'unconfirmed');
      const sourceUrl = line.match(URL_PATTERN)?.[0] ?? null;
      const sourcePath = extractSourcePath(line);
      const claim = cleanClaim(line);
      const findingType: CcwFindingType = ASSUMPTION_PATTERN.test(claim) ? 'assumption' : 'claim';

      return {
        finding_type: findingType,
        tag,
        claim,
        source_label: extractSourceLabel(line, sourceUrl, sourcePath),
        source_url: sourceUrl,
        source_path: sourcePath,
        review_required: tag !== 'verified',
      };
    })
    .filter((finding) => finding.claim.length > 0);
}

export function summariseCcwEvidenceFindings(findings: CcwEvidenceFindingDraft[]) {
  return findings.reduce(
    (summary, finding) => {
      summary.total += 1;
      summary.by_tag[finding.tag] += 1;
      summary.by_type[finding.finding_type] += 1;
      if (finding.review_required) summary.review_required += 1;
      return summary;
    },
    {
      total: 0,
      review_required: 0,
      by_tag: { verified: 0, inference: 0, unconfirmed: 0 },
      by_type: { claim: 0, assumption: 0 },
    }
  );
}
