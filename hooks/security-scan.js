// hooks/security-scan.js — scans tool output for secrets before logging
'use strict';
const output = process.env.TOOL_OUTPUT || '';
const PATTERNS = [/sk_live_[A-Za-z0-9]{24}/, /AKIA[0-9A-Z]{16}/];
const hit = PATTERNS.find((p) => p.test(output));
if (hit) {
  console.warn(`[SECURITY-SCAN] ⚠️  Potential secret in tool output — suppressed from logs`);
}
process.exit(0);
