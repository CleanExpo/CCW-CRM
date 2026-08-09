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
// Frontmatter is parsed with js-yaml, not by hand.
//
// Five review rounds broke the hand parser five different ways. The first four were values that
// LOOKED empty and were accepted — `""`, `null`, `~`, `NULL`, a trailing comment, a bare key. The
// fifth added `!!null`, anchors, aliases, empty folded (`>`) and literal (`|`) scalars, `[]` and
// `{}` — and, worse, two FALSE REJECTIONS: a quoted `"name":` key and any file with CRLF line
// endings, which would fail a Windows contributor's perfectly valid definition.
//
// That is the lesson: a hand parser loses on both sides at once. Tightening it to stop the false
// accepts produced false rejects, and a gate that cries wolf gets switched off, which lands
// exactly where a gate that never fires does. Only a real parser resolves both.
//
// `js-yaml` was already present in package-lock.json as a dev dependency (4.1.1, with argparse),
// so declaring it is a two-line change to package.json and the lockfile's root devDependencies —
// no `npm install`, and none of the `libc` platform-hint churn that made an earlier attempt at
// this look risky. That churn came from running install on npm 10 against a lockfile written by
// npm 11; it was never inherent to the dependency.
const yaml = require('js-yaml');

// A UTF-8 BOM before the opening fence stops `^---` matching, and CRLF leaves a stray \r on every
// line. Both are properties of how the file was SAVED, not of what it says.
const normaliseText = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s).replace(/\r\n/g, '\n');

// The required fields must be non-empty STRINGS. js-yaml resolves `!!null`, `~`, `null` and an
// empty `>`/`|` block to null or '', and `[]`/`{}` to collections — none of which name anything,
// so all of them fail this test rather than needing a special case each.
const isNamed = (v) => typeof v === 'string' && v.trim() !== '';

// `name` is not free text — Claude Code treats it as a unique identifier, and the agent is
// addressed by it. Checking only that it is a non-empty string let this gate pass `name: "123"`,
// which the consumer rejects: a validator that green-lights a definition the actual runtime will
// not load is worse than no validator, because it certifies the wrong thing.
//
// The documented form is lowercase letters and hyphens. Digits are permitted here because names
// like `haiku-4-5` are legitimate in practice and rejecting them would be a false failure; the
// leading character must still be a letter, which is what excludes `123`.
const AGENT_NAME = /^[a-z][a-z0-9-]*$/;
const isValidName = (v) => isNamed(v) && AGENT_NAME.test(v.trim());

// Returns { fields } on a clean parse, { error } otherwise. Anything unreadable is an error, never
// a pass: duplicate keys are ambiguous (first-wins and last-wins disagree about `name: real`
// followed by `name:`), and a malformed document is not a valid one.
function parseFM(raw) {
  const text = normaliseText(raw);
  // The closing fence must be exactly `---` on its own line. A prefix match let `---oops` close
  // the block, so a malformed document read as a well-formed one.
  const m = text.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!m) return { error: 'no readable YAML frontmatter (missing or malformed --- fences)' };

  let doc;
  try {
    doc = yaml.load(m[1], { json: false, onWarning: null });
  } catch (e) {
    return { error: `invalid YAML frontmatter: ${e.reason || e.message}` };
  }
  // js-yaml throws on duplicate keys under the default schema, so the catch above covers them.
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { error: 'frontmatter is not a key/value mapping' };
  }
  return { fields: doc };
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
    if (parsed.error) {
      console.error(`  ❌ ${rel}: ${parsed.error}`);
      errors++;
      return;
    }
    const fm = parsed.fields;
    const missing = ['name', 'description'].filter((k) => !isNamed(fm[k]));
    if (missing.length) {
      console.error(`  ❌ ${rel}: missing ${missing.join(', ')}`);
      errors++;
      return;
    }
    if (!isValidName(fm.name)) {
      console.error(
        `  ❌ ${rel}: name "${fm.name}" is not a valid agent identifier ` +
          '(lowercase letters, digits and hyphens, starting with a letter)'
      );
      errors++;
      return;
    }
    console.log(`  ✅ ${rel}`);
  });
// An EMPTY directory is the same fail-open by another route: `checked` stays 0, `errors` stays 0,
// and a validator that read nothing reports success. Zero agents is never a valid state here.
if (checked === 0) {
  console.error('  ❌ .claude/agents/ contains no agent definitions. Nothing was validated.');
  process.exit(1);
}

console.log(`\nChecked ${checked} agents. ${errors ? `❌ ${errors} error(s)` : '✅ All passed'}\n`);
process.exit(errors ? 1 : 0);
