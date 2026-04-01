// hooks/session-start-load.js — loads previous cycle context at session start
'use strict';
const fs = require('fs');
const path = require('path');
const stateFile = path.join(__dirname, '..', '.claude', 'memory', 'current-state.md');
if (fs.existsSync(stateFile)) {
  console.log(`[SESSION-START] State file present: ${stateFile}`);
}
process.exit(0);
