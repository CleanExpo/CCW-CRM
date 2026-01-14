/**
 * Copy Validator
 * Checks copy against quality rules
 *
 * CRITICAL: INTEGRITY REQUIREMENTS (Non-negotiable)
 * - 100% UNIQUE: No copied content from any source
 * - ZERO PLAGIARISM: Not even close paraphrasing
 * - 100% VERIFIABLE: Every claim must have documented evidence
 *
 * See validation/integrity.yaml for full framework
 */

// ============================================================
// INTEGRITY TYPES (Priority: HIGHEST)
// ============================================================

interface IntegrityResult {
  passed: boolean;
  uniquenessScore: number;
  verifiabilityScore: number;
  issues: IntegrityIssue[];
  claimsRequiringEvidence: ClaimEvidence[];
}

interface IntegrityIssue {
  type: 'plagiarism' | 'unverifiable' | 'missing_evidence' | 'copied_structure';
  severity: 'critical' | 'high' | 'medium';
  location: string;
  found: string;
  requirement: string;
}

interface ClaimEvidence {
  claim: string;
  evidenceType: string;
  evidenceRequired: string;
  verified: boolean;
}

interface ValidationResult {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
}

interface ValidationIssue {
  type: 'error' | 'warning';
  rule: string;
  location: string;
  found: string;
  suggestion: string;
}

interface ValidationWarning {
  rule: string;
  message: string;
}

// Banned words and phrases
const BANNED_WORDS = [
  'leverage',
  'synergy',
  'optimize',
  'cutting-edge',
  'best-in-class',
  'world-class',
  'industry-leading',
  'innovative',
  'revolutionary',
  'utilize',
];

const BANNED_PHRASES = [
  'We pride ourselves on',
  'We are committed to',
  'Our goal is to',
  'We strive to',
  'At the end of the day',
  'Going forward',
  'Think outside the box',
  'Low-hanging fruit',
  'Moving the needle',
  "I'd be happy to",
  'Great question',
  "It's important to note",
];

const CORPORATE_EMPTY_CLAIMS = [
  'Quality is our top priority',
  'Customer satisfaction is #1',
  'We deliver excellence',
  'Trusted professionals',
];

// Validation functions
export function validateCopy(copy: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationWarning[] = [];

  // Check for banned words
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = copy.match(regex);
    if (matches) {
      issues.push({
        type: 'error',
        rule: 'banned_word',
        location: `Found ${matches.length} time(s)`,
        found: word,
        suggestion: getWordReplacement(word),
      });
    }
  }

  // Check for banned phrases
  for (const phrase of BANNED_PHRASES) {
    if (copy.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push({
        type: 'error',
        rule: 'banned_phrase',
        location: 'In copy',
        found: phrase,
        suggestion: 'Remove or rewrite with specific detail',
      });
    }
  }

  // Check for empty claims
  for (const claim of CORPORATE_EMPTY_CLAIMS) {
    if (copy.toLowerCase().includes(claim.toLowerCase())) {
      issues.push({
        type: 'warning',
        rule: 'empty_claim',
        location: 'In copy',
        found: claim,
        suggestion: 'Replace with specific, provable claim',
      });
    }
  }

  // Check sentence length
  const sentences = copy.split(/[.!?]+/).filter(s => s.trim().length > 0);
  for (const sentence of sentences) {
    const wordCount = sentence.trim().split(/\s+/).length;
    if (wordCount > 25) {
      warnings.push({
        rule: 'sentence_length',
        message: `Long sentence (${wordCount} words): "${sentence.trim().substring(0, 50)}..."`,
      });
    }
  }

  // Check paragraph length
  const paragraphs = copy.split(/\n\n+/).filter(p => p.trim().length > 0);
  for (const paragraph of paragraphs) {
    const sentenceCount = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    if (sentenceCount > 4) {
      warnings.push({
        rule: 'paragraph_length',
        message: `Long paragraph (${sentenceCount} sentences). Consider breaking up.`,
      });
    }
  }

  // Check for passive voice indicators
  const passiveIndicators = ['was', 'were', 'been', 'being', 'is being', 'are being'];
  for (const indicator of passiveIndicators) {
    const regex = new RegExp(`\\b${indicator}\\s+\\w+ed\\b`, 'gi');
    if (regex.test(copy)) {
      warnings.push({
        rule: 'passive_voice',
        message: `Possible passive voice detected with "${indicator}". Consider active voice.`,
      });
    }
  }

  // Check for excessive exclamation marks
  const exclamationCount = (copy.match(/!/g) || []).length;
  if (exclamationCount > 2) {
    warnings.push({
      rule: 'exclamation_overuse',
      message: `${exclamationCount} exclamation marks found. Use sparingly.`,
    });
  }

  // Calculate score
  const errorCount = issues.filter(i => i.type === 'error').length;
  const warningCount = issues.filter(i => i.type === 'warning').length + warnings.length;
  const score = Math.max(0, 100 - (errorCount * 10) - (warningCount * 5));

  return {
    passed: errorCount === 0,
    score,
    issues,
    warnings,
  };
}

function getWordReplacement(word: string): string {
  const replacements: Record<string, string> = {
    leverage: 'use',
    utilize: 'use',
    optimize: 'improve',
    synergy: 'work together',
    'cutting-edge': 'modern',
    'best-in-class': 'top',
    'world-class': 'excellent',
    'industry-leading': 'top',
    innovative: 'new',
    revolutionary: 'different',
  };
  return replacements[word.toLowerCase()] || 'simpler word';
}

// Check if claims are verifiable
export function checkVerifiableClaims(copy: string): string[] {
  const unverifiableClaims: string[] = [];

  // Patterns that suggest unverifiable claims
  const patterns = [
    /we('re| are) the best/gi,
    /\d+% (of customers|satisfaction)/gi,
    /(thousands|hundreds) of (happy )?(customers|clients)/gi,
    /everyone (loves|chooses)/gi,
  ];

  for (const pattern of patterns) {
    const matches = copy.match(pattern);
    if (matches) {
      unverifiableClaims.push(...matches);
    }
  }

  return unverifiableClaims;
}

// Main validation export
export function runFullValidation(copy: string): {
  copyValidation: ValidationResult;
  unverifiableClaims: string[];
  readabilityScore: number;
} {
  const copyValidation = validateCopy(copy);
  const unverifiableClaims = checkVerifiableClaims(copy);
  const readabilityScore = calculateReadability(copy);

  return {
    copyValidation,
    unverifiableClaims,
    readabilityScore,
  };
}

function calculateReadability(copy: string): number {
  // Simple readability calculation
  const words = copy.split(/\s+/).length;
  const sentences = copy.split(/[.!?]+/).filter(s => s.trim()).length;
  const avgWordsPerSentence = words / Math.max(sentences, 1);

  // Target: 15-20 words per sentence = 100 score
  // Higher = lower score
  if (avgWordsPerSentence <= 20) {
    return 100;
  } else if (avgWordsPerSentence <= 25) {
    return 80;
  } else if (avgWordsPerSentence <= 30) {
    return 60;
  } else {
    return 40;
  }
}

// ============================================================
// INTEGRITY VALIDATION (Priority: HIGHEST - Non-negotiable)
// ============================================================

/**
 * CRITICAL: Run BEFORE any other validation
 * All copy MUST pass integrity checks before publishing
 */
export function validateIntegrity(copy: string): IntegrityResult {
  const issues: IntegrityIssue[] = [];
  const claimsRequiringEvidence: ClaimEvidence[] = [];

  // Extract and validate all claims that require evidence
  const claims = extractVerifiableClaims(copy);
  for (const claim of claims) {
    claimsRequiringEvidence.push({
      claim: claim.text,
      evidenceType: claim.type,
      evidenceRequired: claim.evidenceNeeded,
      verified: false, // Must be manually verified
    });
  }

  // Check for unverifiable superlatives
  const superlativePatterns = [
    { pattern: /\b(best|greatest|top|leading|premier|finest)\b/gi, type: 'superlative' },
    { pattern: /\b(cheapest|lowest|most affordable)\b/gi, type: 'price_claim' },
    { pattern: /\b(fastest|quickest)\b/gi, type: 'speed_claim' },
    { pattern: /\b(most experienced|most trusted)\b/gi, type: 'experience_claim' },
  ];

  for (const { pattern, type } of superlativePatterns) {
    const matches = copy.match(pattern);
    if (matches) {
      for (const match of matches) {
        issues.push({
          type: 'unverifiable',
          severity: 'critical',
          location: `Contains "${match}"`,
          found: match,
          requirement: `Superlative "${match}" requires documented proof or must be removed/replaced with specific verifiable claim`,
        });
      }
    }
  }

  // Check for vague numbers that need verification
  const vagueNumberPatterns = [
    { pattern: /\b(thousands|hundreds|dozens) of\b/gi, issue: 'Vague quantity - use specific number' },
    { pattern: /\b\d+\+?\s*(years?|customers?|clients?|projects?)/gi, issue: 'Number claim requires evidence' },
    { pattern: /\b\d+%\s*(satisfaction|success|guarantee)/gi, issue: 'Percentage claim requires source' },
    { pattern: /\b(over|more than)\s+\d+/gi, issue: 'Approximate number - verify exact count' },
  ];

  for (const { pattern, issue } of vagueNumberPatterns) {
    const matches = copy.match(pattern);
    if (matches) {
      for (const match of matches) {
        claimsRequiringEvidence.push({
          claim: match,
          evidenceType: 'numerical',
          evidenceRequired: issue,
          verified: false,
        });
      }
    }
  }

  // Check for generic phrases that indicate possible copying
  const genericPhrases = [
    'committed to excellence',
    'dedicated team of professionals',
    'customer satisfaction is our priority',
    'quality you can trust',
    'your satisfaction guaranteed',
    'we go above and beyond',
    'no job too big or small',
    'serving the community since',
    'family owned and operated',
    'free no-obligation quote',
  ];

  for (const phrase of genericPhrases) {
    if (copy.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push({
        type: 'copied_structure',
        severity: 'medium',
        location: `Contains "${phrase}"`,
        found: phrase,
        requirement: 'Generic phrase detected - likely not original. Rewrite with specific, unique language.',
      });
    }
  }

  // Calculate scores
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const unverifiedClaims = claimsRequiringEvidence.filter(c => !c.verified).length;

  const uniquenessScore = Math.max(0, 100 - (issues.length * 15));
  const verifiabilityScore = claimsRequiringEvidence.length > 0
    ? Math.round((claimsRequiringEvidence.filter(c => c.verified).length / claimsRequiringEvidence.length) * 100)
    : 100;

  return {
    passed: criticalIssues === 0 && unverifiedClaims === 0,
    uniquenessScore,
    verifiabilityScore,
    issues,
    claimsRequiringEvidence,
  };
}

/**
 * Extract claims that require evidence documentation
 */
function extractVerifiableClaims(copy: string): Array<{ text: string; type: string; evidenceNeeded: string }> {
  const claims: Array<{ text: string; type: string; evidenceNeeded: string }> = [];

  // License claims
  const licensePattern = /\b(licensed|certified|accredited|registered)\b[^.!?]*/gi;
  const licenseMatches = copy.match(licensePattern) || [];
  for (const match of licenseMatches) {
    claims.push({
      text: match.trim(),
      type: 'license',
      evidenceNeeded: 'License number + registry lookup link',
    });
  }

  // Experience claims
  const experiencePattern = /\b(\d+\+?\s*years?|since\s+\d{4}|established\s+\d{4})\b[^.!?]*/gi;
  const experienceMatches = copy.match(experiencePattern) || [];
  for (const match of experienceMatches) {
    claims.push({
      text: match.trim(),
      type: 'experience',
      evidenceNeeded: 'Business registration date or verifiable history',
    });
  }

  // Review/rating claims
  const reviewPattern = /\b(\d+\.?\d*\s*stars?|\d+\+?\s*reviews?|rated?\s*\d+)/gi;
  const reviewMatches = copy.match(reviewPattern) || [];
  for (const match of reviewMatches) {
    claims.push({
      text: match.trim(),
      type: 'reviews',
      evidenceNeeded: 'Platform link with current count + screenshot with date',
    });
  }

  // Response time claims
  const responsePattern = /\b(within\s+\d+\s*(hours?|minutes?)|same.day|24.?7)\b[^.!?]*/gi;
  const responseMatches = copy.match(responsePattern) || [];
  for (const match of responseMatches) {
    claims.push({
      text: match.trim(),
      type: 'response_time',
      evidenceNeeded: 'Internal policy or service level data',
    });
  }

  // Warranty/guarantee claims
  const warrantyPattern = /\b(\d+.?(year|month|day)\s*(warranty|guarantee)|money.back)\b[^.!?]*/gi;
  const warrantyMatches = copy.match(warrantyPattern) || [];
  for (const match of warrantyMatches) {
    claims.push({
      text: match.trim(),
      type: 'warranty',
      evidenceNeeded: 'Written warranty terms document',
    });
  }

  return claims;
}

/**
 * MASTER VALIDATION - Run all checks in priority order
 */
export function runMasterValidation(copy: string): {
  integrity: IntegrityResult;
  content: ValidationResult;
  unverifiableClaims: string[];
  readabilityScore: number;
  canPublish: boolean;
  blockingIssues: string[];
} {
  // INTEGRITY FIRST (Non-negotiable)
  const integrity = validateIntegrity(copy);

  // Content validation
  const content = validateCopy(copy);
  const unverifiableClaims = checkVerifiableClaims(copy);
  const readabilityScore = calculateReadability(copy);

  // Determine if content can be published
  const blockingIssues: string[] = [];

  if (!integrity.passed) {
    const criticalCount = integrity.issues.filter(i => i.severity === 'critical').length;
    if (criticalCount > 0) {
      blockingIssues.push(`${criticalCount} critical integrity issue(s) - unverifiable claims must be removed or documented`);
    }
    const unverifiedCount = integrity.claimsRequiringEvidence.filter(c => !c.verified).length;
    if (unverifiedCount > 0) {
      blockingIssues.push(`${unverifiedCount} claim(s) require evidence documentation before publishing`);
    }
  }

  if (!content.passed) {
    blockingIssues.push('Content validation failed - banned words/phrases detected');
  }

  return {
    integrity,
    content,
    unverifiableClaims,
    readabilityScore,
    canPublish: blockingIssues.length === 0,
    blockingIssues,
  };
}

/**
 * Generate evidence documentation template for claims
 */
export function generateEvidenceTemplate(copy: string): string {
  const integrity = validateIntegrity(copy);

  let template = `# Evidence Documentation\n`;
  template += `# ALL claims must have documented evidence before publishing\n\n`;
  template += `Generated: ${new Date().toISOString()}\n\n`;

  if (integrity.claimsRequiringEvidence.length === 0) {
    template += `No specific claims requiring evidence detected.\n`;
    template += `However, manually verify all statements are accurate.\n`;
  } else {
    template += `## Claims Requiring Evidence\n\n`;
    for (const claim of integrity.claimsRequiringEvidence) {
      template += `### Claim: "${claim.claim}"\n`;
      template += `- Type: ${claim.evidenceType}\n`;
      template += `- Evidence Required: ${claim.evidenceRequired}\n`;
      template += `- Verified: [ ] No\n`;
      template += `- Evidence Location: _________________\n`;
      template += `- Verified Date: _________________\n`;
      template += `- Verified By: _________________\n\n`;
    }
  }

  if (integrity.issues.length > 0) {
    template += `## Issues to Resolve\n\n`;
    for (const issue of integrity.issues) {
      template += `- [${issue.severity.toUpperCase()}] ${issue.found}\n`;
      template += `  Requirement: ${issue.requirement}\n\n`;
    }
  }

  return template;
}
