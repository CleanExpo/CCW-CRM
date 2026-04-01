// hooks/governance-capture.js — logs all tool actions to governance trail
'use strict';
const fs = require('fs');
const path = require('path');
const tool = process.env.TOOL_NAME || 'unknown';
const logFile = path.join(__dirname, '..', '.claude', 'memory', 'governance.log');
try {
  fs.appendFileSync(logFile, JSON.stringify({ ts: new Date().toISOString(), tool }) + '\n');
} catch (_) {}

// Detect secrets in output
const output = process.env.TOOL_OUTPUT || '';
const secretPatterns = [/sk_live_[A-Za-z0-9]{24}/, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\-]{50,}/];
const hit = secretPatterns.find(p => p.test(output));
if (hit) console.warn(`[GOVERNANCE] ⚠️  Potential secret detected in ${tool} output`);
process.exit(0);
