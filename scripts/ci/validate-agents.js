#!/usr/bin/env node
// scripts/ci/validate-agents.js — checks .claude/agents/ YAML frontmatter
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const AGENTS_DIR = path.join(ROOT, '.claude', 'agents');
let errors = 0,
  checked = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
function parseFM(c) {
  const m = c.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  return Object.fromEntries(
    m[1]
      .split('\n')
      .filter((l) => l.includes(':'))
      .map((l) => {
        const [k, ...v] = l.split(':');
        return [k.trim(), v.join(':').trim()];
      })
  );
}

console.log('\n🔍 Validating agent frontmatter...\n');

// A missing directory is a FAILURE, not a skip. This used to `process.exit(0)` with a warning,
// which made the whole gate fail-open. `AGENTS_DIR` is repository-local, and at `b059c8f7` —
// where the agents were not tracked — `git ls-files .claude` returned 0, so a checkout of that
// commit had nothing here and this validator exited 0 having read nothing. Tracking the agents
// fixes that checkout; exiting non-zero here is what stops the vacuum returning the moment
// someone removes or re-ignores them.
if (!fs.existsSync(AGENTS_DIR)) {
  console.error('  ❌ .claude/agents/ not found. It is tracked — a missing directory means it was');
  console.error('     deleted or re-ignored, which silently disables this check.');
  process.exit(1);
}

walk(AGENTS_DIR)
  .filter((f) => f.endsWith('.md'))
  .forEach((f) => {
    checked++;
    const fm = parseFM(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(ROOT, f);
    if (!fm) {
      console.error(`  ❌ ${rel}: No YAML frontmatter`);
      errors++;
      return;
    }
    const missing = ['name', 'description'].filter((k) => !fm[k]);
    missing.length
      ? (console.error(`  ❌ ${rel}: missing ${missing.join(', ')}`), errors++)
      : console.log(`  ✅ ${rel}`);
  });
// An EMPTY directory is the same fail-open by a second route: `checked` stays 0, `errors` stays
// 0, and a validator that read nothing reports success. Zero agents is never a valid state in a
// repo that tracks them.
if (checked === 0) {
  console.error('  ❌ .claude/agents/ contains no agent definitions. Nothing was validated.');
  process.exit(1);
}

console.log(`\nChecked ${checked} agents. ${errors ? `❌ ${errors} error(s)` : '✅ All passed'}\n`);
process.exit(errors ? 1 : 0);
