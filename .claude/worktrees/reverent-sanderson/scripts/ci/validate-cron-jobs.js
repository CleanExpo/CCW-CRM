#!/usr/bin/env node
// scripts/ci/validate-cron-jobs.js — checks boardroom scripts have Linear refs
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const BOARDROOM = path.join(ROOT, 'scripts', 'boardroom');
let errors = 0,
  checked = 0;

console.log('\n🔍 Validating CRON job registrations...\n');
if (!fs.existsSync(BOARDROOM)) {
  console.warn('⚠️  scripts/boardroom/ not found — skipping');
  process.exit(0);
}

fs.readdirSync(BOARDROOM)
  .filter((f) => f.endsWith('.js'))
  .forEach((f) => {
    checked++;
    const content = fs.readFileSync(path.join(BOARDROOM, f), 'utf8');
    const ref = content.match(/UNI-\d+/);
    ref
      ? console.log(`  ✅ ${f} (${ref[0]})`)
      : (console.error(`  ❌ ${f}: No Linear issue reference`), errors++);
  });
console.log(
  `\nChecked ${checked} scripts. ${errors ? `❌ ${errors} error(s)` : '✅ All passed'}\n`
);
process.exit(errors ? 1 : 0);
