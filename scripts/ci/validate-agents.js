#!/usr/bin/env node
// scripts/ci/validate-agents.js — checks .claude/agents/ YAML frontmatter
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const AGENTS_DIR = path.join(ROOT, '.claude', 'agents');
let errors = 0, checked = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}
function parseFM(c) {
  const m = c.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  return Object.fromEntries(m[1].split('\n').filter(l=>l.includes(':')).map(l=>{
    const [k,...v]=l.split(':'); return [k.trim(), v.join(':').trim()];
  }));
}

console.log('\n🔍 Validating agent frontmatter...\n');
if (!fs.existsSync(AGENTS_DIR)) { console.warn('⚠️  .claude/agents/ not found — skipping'); process.exit(0); }

walk(AGENTS_DIR).filter(f=>f.endsWith('.md')).forEach(f => {
  checked++;
  const fm = parseFM(fs.readFileSync(f,'utf8'));
  const rel = path.relative(ROOT, f);
  if (!fm) { console.error(`  ❌ ${rel}: No YAML frontmatter`); errors++; return; }
  const missing = ['name','description'].filter(k=>!fm[k]);
  missing.length ? (console.error(`  ❌ ${rel}: missing ${missing.join(', ')}`), errors++)
                 : console.log(`  ✅ ${rel}`);
});
console.log(`\nChecked ${checked} agents. ${errors ? `❌ ${errors} error(s)` : '✅ All passed'}\n`);
process.exit(errors ? 1 : 0);
