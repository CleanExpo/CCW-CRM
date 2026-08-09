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
// This is NOT a YAML parser and does not try to be one. Three review rounds found three ways to
// get a semantically empty value past it — `""`, then `null`/`~`, then a trailing comment, an
// uppercase `NULL` and a bare `name:`. Each patch bought the next variant, because a permissive
// parser's failure mode is to ACCEPT what it did not understand.
//
// So the rule is inverted: this validates one narrow contract — `name` and `description` must be
// non-empty scalars — and REJECTS anything it cannot read confidently. A false rejection is a
// loud, immediate build failure someone fixes in a minute. A false acceptance is a gate that
// silently stops working, which is the entire defect this file exists to close.
//
// js-yaml was the obvious alternative and was deliberately not used: it is present only as a
// transitive dependency, and declaring it rewrote `libc` platform hints throughout
// package-lock.json on this npm version — real risk to CI platform resolution, for a 40-line
// contract.

// A UTF-8 BOM before the opening fence made `^---` fail, rejecting a valid file. Strip it.
const stripBOM = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

// YAML's ways of spelling "no value", case-insensitively.
const NULLISH = new Set(['', '~', 'null']);

// Returns the scalar, or null when the value is absent, empty, or something this parser will not
// vouch for. Callers treat null as a failure — never as "probably fine".
function scalar(raw) {
  let v = raw.trim();

  if (v.startsWith('"') || v.startsWith("'")) {
    // A quoted scalar: take exactly what is inside the matching close quote. Anything after it
    // (a comment, stray text) is ignored, but an unterminated quote is a reject.
    const q = v[0];
    const end = v.indexOf(q, 1);
    if (end === -1) return null;
    v = v.slice(1, end).trim();
  } else {
    // An unquoted scalar ends at a comment. ` #` starts one; a bare `#` in the middle of a word
    // does not, which is why the space is required.
    const hash = v.search(/(^|\s)#/);
    if (hash !== -1) v = v.slice(0, hash).trim();
  }

  return NULLISH.has(v.toLowerCase()) ? null : v;
}

function parseFM(c) {
  // The closing fence must be EXACTLY `---` on its own line. The previous pattern matched a
  // prefix, so `---oops` closed the block and the file validated — a malformed document read as
  // a well-formed one.
  const m = stripBOM(c).match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!m) return null;

  const out = {};
  const duplicates = [];
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    // A repeated key is AMBIGUOUS — first-wins and last-wins disagree, and `name: real` followed
    // by `name:` reads as valid under one and empty under the other. Rejecting is the only answer
    // that cannot be gamed: otherwise a real value can be shadowed, or an empty one rescued,
    // depending on which rule the reader assumes.
    if (key in out) duplicates.push(key);
    else out[key] = scalar(line.slice(colon + 1));
  }
  return { fields: out, duplicates };
}

console.log('\n🔍 Validating agent frontmatter...\n');

// A missing directory is a FAILURE, not a skip. This used to `process.exit(0)` with a warning,
// which made the gate fail-open: `.claude/` was gitignored, so on a CI runner the directory was
// always absent and this validator passed on every push while reading nothing. Tracking the
// agents fixes today's checkout; exiting non-zero here is what stops the vacuum returning the
// moment someone re-ignores the directory or deletes its contents.
if (!fs.existsSync(AGENTS_DIR)) {
  console.error('  ❌ .claude/agents/ not found. It is tracked — a missing directory means it was');
  console.error('     deleted or re-ignored, which silently disables this check.');
  process.exit(1);
}

walk(AGENTS_DIR)
  .filter((f) => f.endsWith('.md'))
  .forEach((f) => {
    checked++;
    const parsed = parseFM(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(ROOT, f);
    if (!parsed) {
      console.error(`  ❌ ${rel}: no readable YAML frontmatter (missing or malformed --- fences)`);
      errors++;
      return;
    }
    if (parsed.duplicates.length) {
      console.error(`  ❌ ${rel}: duplicate key(s) ${[...new Set(parsed.duplicates)].join(', ')}`);
      errors++;
      return;
    }
    const fm = parsed.fields;
    const missing = ['name', 'description'].filter((k) => !fm[k]);
    missing.length
      ? (console.error(`  ❌ ${rel}: missing ${missing.join(', ')}`), errors++)
      : console.log(`  ✅ ${rel}`);
  });
// An EMPTY directory is the same fail-open by another route: `checked` stays 0, `errors` stays 0,
// and a validator that read nothing reports success. Zero agents is never a valid state here.
if (checked === 0) {
  console.error('  ❌ .claude/agents/ contains no agent definitions. Nothing was validated.');
  process.exit(1);
}

console.log(`\nChecked ${checked} agents. ${errors ? `❌ ${errors} error(s)` : '✅ All passed'}\n`);
process.exit(errors ? 1 : 0);
