#!/usr/bin/env node
// scripts/ci/validate-hooks.js — validates hooks/hooks.json structure
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const HOOKS_FILE = path.join(ROOT, 'hooks', 'hooks.json');
let errors = 0;
const fail = (msg) => {
  console.error(`  ❌ ${msg}`);
  errors++;
};
const pass = (msg) => console.log(`  ✅ ${msg}`);

console.log('\n🔍 Validating hooks/hooks.json...\n');
if (!fs.existsSync(HOOKS_FILE)) {
  fail('hooks/hooks.json not found');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(HOOKS_FILE, 'utf8'));
  pass('hooks.json is valid JSON');
} catch (e) {
  fail(`Parse error: ${e.message}`);
  process.exit(1);
}

if (!config.hooks) {
  fail('Missing top-level "hooks" key');
  process.exit(1);
}
['PreToolUse', 'PostToolUse', 'Stop'].forEach((e) =>
  config.hooks[e] ? pass(`"${e}" defined`) : fail(`Missing event: "${e}"`)
);

// Check all referenced node scripts exist
const refs = JSON.stringify(config).match(/hooks\/[^"]+\.js/g) || [];
console.log(`\n🔍 Checking ${refs.length} referenced scripts...\n`);
refs.forEach((ref) => {
  const full = path.join(ROOT, ref);
  fs.existsSync(full) ? pass(ref) : fail(`${ref} missing`);
});
console.log(`\n${errors ? `❌ ${errors} error(s)` : '✅ All validations passed'}\n`);
process.exit(errors ? 1 : 0);
