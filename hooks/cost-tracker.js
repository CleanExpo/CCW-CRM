// hooks/cost-tracker.js — tracks session token usage
'use strict';
const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, '..', '.claude', 'memory', 'cost-tracker.log');
try {
  const entry = { ts: new Date().toISOString(), session: process.env.SESSION_ID || 'unknown' };
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
} catch (_) {}
process.exit(0);
