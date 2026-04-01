// hooks/session-state-save.js — persists session state before context loss
'use strict';
const fs = require('fs');
const path = require('path');
const stateFile = path.join(__dirname, '..', '.claude', 'memory', 'context-snapshot.md');
try {
  const existing = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : '';
  const stamp = `\n<!-- Last session end: ${new Date().toISOString()} -->\n`;
  if (!existing.includes(stamp.trim())) fs.appendFileSync(stateFile, stamp);
} catch (_) {}
process.exit(0);
