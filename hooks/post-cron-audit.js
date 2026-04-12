// hooks/post-cron-audit.js — post-CRON completion audit
'use strict';
const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, '..', '.claude', 'memory', 'cron-audit.log');
try {
  const entry = {
    ts: new Date().toISOString(),
    event: 'cron-complete',
    tool: process.env.TOOL_NAME,
  };
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
} catch (_) {}
process.exit(0);
