// scripts/sanitise.js — UNI-1720
// Strips prompt injection vectors from ALL external content before LLM context entry.
'use strict';

const SUSPICIOUS = [
  /ignore\s+(all\s+)?(previous|prior|above)/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /execute\s+(the\s+following|this)/i,
  /\bnew\s+instructions?\b/i,
  /disregard\s+(all\s+)?/i,
  /rm\s+-rf/i,
  /DROP\s+TABLE/i,
  /curl\s+.*\|\s*bash/i,
];

/**
 * Sanitise external content before passing to LLM.
 * @param {string} content - Raw external content
 * @param {string} source  - Source identifier (e.g. 'perplexity', 'apify', 'youtube')
 * @returns {{ content: string, flags: string[], source: string, timestamp: string }}
 */
function sanitiseExternalContent(content, source = 'unknown') {
  if (!content || typeof content !== 'string') {
    return { content: '', flags: [], source, timestamp: new Date().toISOString() };
  }

  let clean = content
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments
    .replace(/<script[\s\S]*?<\/script>/gi, '') // Script tags
    .replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, '[BASE64_REMOVED]') // Base64 data URIs
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '') // Zero-width chars
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '') // Bidi overrides
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '') // ANSI sequences
    .replace(/\u0000/g, ''); // Null bytes

  const flags = SUSPICIOUS.filter((p) => p.test(clean)).map((p) => p.source);

  if (flags.length > 0) {
    console.warn(
      `[SANITISE] ${source}: ${flags.length} suspicious pattern(s) detected — logged to audit trail`
    );
    // In production, append to audit log
    try {
      const fs = require('fs');
      const logPath = require('path').join(
        __dirname,
        '..',
        '.claude',
        'memory',
        'security-audit.log'
      );
      const entry = JSON.stringify({ ts: new Date().toISOString(), source, flags }) + '\n';
      fs.appendFileSync(logPath, entry);
    } catch (_) {}
  }

  return { content: clean, flags, source, timestamp: new Date().toISOString() };
}

module.exports = { sanitiseExternalContent };
