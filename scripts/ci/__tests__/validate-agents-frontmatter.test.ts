import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// These drive the REAL CLI over a fixture tree, not an exported helper. `validate-agents.js`
// derives its root from `__dirname`, and the behaviours that matter — a missing directory, an
// empty one, the exit code — exist only in that top-level flow. A test that imported a parser
// function could not fail when the flow around it is wrong, which is how three of these routes
// stayed open across three review rounds.
//
// Every frontmatter case below is written LITERALLY. Nothing is generated from the parser's own
// rules; a fixture derived from the implementation passes whatever the implementation says.
const SCRIPT = resolve(__dirname, '..', 'validate-agents.js');
// The fixture tree lives outside the repo, so `require('js-yaml')` inside the copied script has
// nothing to walk up to. NODE_PATH points it at the real dependencies instead of putting fixture
// directories inside the working tree, which would leave litter that dirties `git status`.
const REPO_NODE_MODULES = resolve(__dirname, '..', '..', '..', 'node_modules');

describe('validate-agents.js frontmatter contract', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'validate-agents-'));
    mkdirSync(join(root, 'scripts', 'ci'), { recursive: true });
    mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
    copyFileSync(SCRIPT, join(root, 'scripts', 'ci', 'validate-agents.js'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const run = (body?: string) => {
    if (body !== undefined) writeFileSync(join(root, '.claude', 'agents', 'probe.md'), body);
    return spawnSync(process.execPath, [join(root, 'scripts', 'ci', 'validate-agents.js')], {
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: REPO_NODE_MODULES },
    }).status;
  };

  // The gate must FAIL when it would otherwise report success having validated nothing.
  // All three of these were live fail-open routes found by review.
  it('fails when .claude/agents/ is missing', () => {
    rmSync(join(root, '.claude', 'agents'), { recursive: true, force: true });
    expect(run()).toBe(1);
  });

  it('fails when .claude/agents/ is present but empty', () => {
    expect(run()).toBe(1);
  });

  // The walk is RECURSIVE — Claude Code scans `.claude/agents` recursively, and this validator
  // implements that. Every other fixture here is top-level, so replacing the directory branch of
  // the walk with `[]` left the whole suite green: nested agents could stop being validated
  // entirely and nothing would notice. These two pin the recursion in both directions.
  const writeNested = (body: string) => {
    const dir = join(root, '.claude', 'agents', 'nested', 'deeper');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'nested-agent.md'), body);
  };

  it('validates an agent in a nested subdirectory', () => {
    writeNested('---\nname: nested-agent\ndescription: Valid.\n---\nb\n');
    expect(run('---\nname: top-agent\ndescription: Valid.\n---\nb\n')).toBe(0);
  });

  it('fails on a BROKEN agent in a nested subdirectory when the top level is fine', () => {
    writeNested('---\nname: nested-agent\ndescription: ""\n---\nb\n');
    expect(run('---\nname: top-agent\ndescription: Valid.\n---\nb\n')).toBe(1);
  });

  // Deliberately a VALID nested agent with nothing at the top level. If the walk stopped
  // recursing, `checked` would be 0 and the empty-directory guard would exit 1 — so this test
  // would still "pass" if it expected 1, for entirely the wrong reason. Expecting 0 is what makes
  // it discriminate: only a genuinely recursive walk finds this file and reports success.
  it('finds a valid agent that exists ONLY in a subdirectory', () => {
    writeNested('---\nname: nested-agent\ndescription: Valid.\n---\nb\n');
    expect(run()).toBe(0);
  });

  // `name` is a UNIQUE identifier. Claude Code detects duplicates and loads exactly one
  // definition, so a validator that checks each file in isolation certifies a second agent that
  // is silently shadowed and never runs.
  it('fails on two agents sharing a name in the same directory', () => {
    writeFileSync(
      join(root, '.claude', 'agents', 'other.md'),
      '---\nname: top-agent\ndescription: A duplicate.\n---\nb\n'
    );
    expect(run('---\nname: top-agent\ndescription: Valid.\n---\nb\n')).toBe(1);
  });

  // The walk is recursive, so the duplicate need not be a sibling — this is the case the
  // reviewer demonstrated passing.
  it('fails on a duplicate name hiding in a subdirectory', () => {
    writeNested('---\nname: top-agent\ndescription: A nested duplicate.\n---\nb\n');
    expect(run('---\nname: top-agent\ndescription: Valid.\n---\nb\n')).toBe(1);
  });

  it('accepts two agents with different names across directories', () => {
    writeNested('---\nname: nested-agent\ndescription: Valid.\n---\nb\n');
    expect(run('---\nname: top-agent\ndescription: Valid.\n---\nb\n')).toBe(0);
  });

  it.each([
    ['double-quoted empty', '---\nname: ""\ndescription: ""\n---\nb\n'],
    ['single-quoted empty', "---\nname: ''\ndescription: ''\n---\nb\n"],
    ['lowercase null', '---\nname: null\ndescription: null\n---\nb\n'],
    ['uppercase NULL', '---\nname: NULL\ndescription: NULL\n---\nb\n'],
    ['mixed-case Null', '---\nname: Null\ndescription: Null\n---\nb\n'],
    ['tilde', '---\nname: ~\ndescription: ~\n---\nb\n'],
    ['whitespace-only quoted', '---\nname: "   "\ndescription: " "\n---\nb\n'],
    ['bare empty after colon', '---\nname:\ndescription:\n---\nb\n'],
    ['comment-only value', '---\nname: # absent\ndescription: # absent\n---\nb\n'],
    ['quoted empty then comment', '---\nname: "" # absent\ndescription: "" # x\n---\nb\n'],
    ['duplicate key', '---\nname: real\nname:\ndescription: d\n---\nb\n'],
    ['malformed closing fence', '---\nname: n\ndescription: d\n---oops\nb\n'],
    ['no frontmatter', 'just a body\n'],
    ['unclosed frontmatter', '---\nname: n\ndescription: d\n'],
    ['unterminated quote', '---\nname: "unterminated\ndescription: d\n---\nb\n'],
    // YAML has many ways to write "nothing" that a hand parser reads as text.
    ['an explicit !!null tag', '---\nname: !!null\ndescription: !!null\n---\nb\n'],
    ['a bare anchor', '---\nname: &a\ndescription: &b\n---\nb\n'],
    ['an alias to an empty scalar', '---\nname: &a\ndescription: *a\n---\nb\n'],
    ['an empty folded scalar', '---\nname: >\ndescription: >\n---\nb\n'],
    ['an empty literal scalar', '---\nname: |\ndescription: |\n---\nb\n'],
    ['a flow sequence', '---\nname: []\ndescription: []\n---\nb\n'],
    ['a flow mapping', '---\nname: {}\ndescription: {}\n---\nb\n'],
    ['a non-mapping document', '---\n- just\n- a list\n---\nb\n'],
    ['tab-indented invalid YAML', '---\nname: n\n\tdescription: d\n---\nb\n'],
    ['junk after a quoted scalar', '---\nname: "n" junk\ndescription: d\n---\nb\n'],
  ])('rejects %s', (_label, body) => {
    expect(run(body)).toBe(1);
  });

  // Each required field is pinned SEPARATELY. Every fixture above invalidates name and
  // description together, so dropping `description` from the production required-field list left
  // all of them green — the suite could not tell the two checks apart. These can.
  it('rejects a valid name with an empty description', () => {
    expect(run('---\nname: real\ndescription: ""\n---\nb\n')).toBe(1);
  });

  it('rejects a valid description with an empty name', () => {
    expect(run('---\nname: ""\ndescription: A real description.\n---\nb\n')).toBe(1);
  });

  it('rejects a file missing the description key entirely', () => {
    expect(run('---\nname: real\n---\nb\n')).toBe(1);
  });

  it('rejects a file missing the name key entirely', () => {
    expect(run('---\ndescription: A real description.\n---\nb\n')).toBe(1);
  });

  // The contract is a non-empty STRING, not merely a truthy value. YAML resolves these to a
  // number, a boolean and a Date — all truthy, none of them a name or a description. Without
  // these, relaxing `isNamed` to accept any truthy scalar passed the whole suite.
  //
  // Rejecting them is deliberate rather than incidental: an agent whose name is `123` is almost
  // certainly a mistake, and the fix — quote it — is obvious from the error. A validator that
  // silently accepted a Date as a description would be back to reporting success over something
  // that names nothing.
  it.each([
    ['an unquoted integer', '---\nname: 123\ndescription: 456\n---\nb\n'],
    ['an unquoted float', '---\nname: 1.5\ndescription: 2.5\n---\nb\n'],
    ['an unquoted boolean', '---\nname: true\ndescription: false\n---\nb\n'],
    ['an unquoted date', '---\nname: 2026-08-09\ndescription: 2026-08-09\n---\nb\n'],
  ])('rejects %s as a required field', (_label, body) => {
    expect(run(body)).toBe(1);
  });

  // ONLY the two rules the loader actually enforces are asserted here. Three earlier revisions
  // pinned invented contracts — letter-first, then 3-50 characters, then a widened variant —
  // and each locked in a false rejection of names Claude Code loads fine. Review adjudicated it
  // against the installed parseAgentFromMarkdown: no length limit, any non-empty string except a
  // leading hyphen or an embedded colon.
  it.each([
    ['a leading hyphen', '---\nname: "-ccw"\ndescription: Valid.\n---\nb\n'],
    ['an embedded colon', '---\nname: "ccw:builder"\ndescription: Valid.\n---\nb\n'],
    // The loader tests `name.normalize('NFKC').includes(':')`. A fullwidth colon (U+FF1A)
    // normalises to a plain one, so a raw-string check let this through — a name the runtime
    // refuses, certified as valid.
    ['a fullwidth colon', '---\nname: "ccw：builder"\ndescription: Valid.\n---\nb\n'],
  ])('rejects a name with %s', (_label, body) => {
    expect(run(body)).toBe(1);
  });

  // These are all LOADER-VALID. Every one was rejected by at least one earlier revision of this
  // gate, so they are pinned as accepted to stop a fourth invented contract creeping back in.
  it.each([
    ['one character', '---\nname: a\ndescription: Valid.\n---\nb\n'],
    ['two characters', '---\nname: ab\ndescription: Valid.\n---\nb\n'],
    ['a leading digit', '---\nname: 4-eng\ndescription: Valid.\n---\nb\n'],
    ['an all-digit quoted name', '---\nname: "123"\ndescription: Valid.\n---\nb\n'],
    ['a trailing hyphen', '---\nname: ccw-\ndescription: Valid.\n---\nb\n'],
    ['capitals', '---\nname: CCW-Builder\ndescription: Valid.\n---\nb\n'],
    ['an underscore', '---\nname: ccw_builder\ndescription: Valid.\n---\nb\n'],
    ['digits and hyphens', '---\nname: haiku-4-5\ndescription: "Anything: goes #1."\n---\nb\n'],
  ])('accepts the loader-valid name with %s', (_label, body) => {
    expect(run(body)).toBe(0);
  });

  // An UNQUOTED 123 is still rejected, for a different reason entirely: YAML resolves it to a
  // Number, and the value must be a STRING before any name rule applies. Keeping the quoted and
  // unquoted cases apart stops a later fix collapsing two independent rules into one.
  it('still rejects an unquoted all-digit name as a non-string', () => {
    expect(run('---\nname: 123\ndescription: Valid.\n---\nb\n')).toBe(1);
  });


  // `description` has no shape rule, so its ONLY protection is the string requirement in
  // `isNamed`. Every other non-string fixture pairs a bad description with a bad name, and the
  // name's identifier check fails first — masking whether the description rule works at all.
  // My own mutation control found this: weakening `isNamed` to stringify its input left the whole
  // suite green. These pin the description separately, with a valid name alongside.
  it.each([
    ['a number', '---\nname: real-agent\ndescription: 123\n---\nb\n'],
    ['a boolean', '---\nname: real-agent\ndescription: true\n---\nb\n'],
    ['a date', '---\nname: real-agent\ndescription: 2026-08-09\n---\nb\n'],
  ])('rejects a description that YAML resolves to %s', (_label, body) => {
    expect(run(body)).toBe(1);
  });

  // Equally important: the strict parser must not reject legitimate files. A gate that cries wolf
  // gets disabled, which lands in the same place as a gate that never fires.
  it.each([
    ['a plain valid definition', '---\nname: real\ndescription: A real description.\n---\nb\n'],
    ['a UTF-8 BOM prefix', '﻿---\nname: real\ndescription: Valid.\n---\nb\n'],
    ['a quoted value containing a colon', '---\nname: real\ndescription: "Has: a colon"\n---\nb\n'],
    ['a mid-word hash', '---\nname: real\ndescription: Issue #42 tracked\n---\nb\n'],
    ['a trailing comment', '---\nname: real\ndescription: Valid # note\n---\nb\n'],
    ['a comment line', '---\n# comment\nname: real\ndescription: Valid.\n---\nb\n'],
    ['trailing spaces on the closing fence', '---\nname: real\ndescription: Valid.\n---   \nb\n'],
    // The parser deliberately allows horizontal whitespace after BOTH fences, but only the
    // closing one was covered. Narrowing the opening expression back to `^---\n` reintroduced a
    // false rejection with the whole suite still green — an implemented valid-input path that
    // nothing was holding in place.
    ['trailing spaces on the opening fence', '---  \nname: real\ndescription: Valid.\n---\nb\n'],
    ['a tab after the opening fence', '---\t\nname: real\ndescription: Valid.\n---\nb\n'],
    ['whitespace after both fences', '--- \nname: real\ndescription: Valid.\n--- \nb\n'],
    // The `(?:\n|$)` branch accepts a closing fence at end of file — a real implemented path that
    // no fixture exercised, so narrowing it to `\n` left the suite green.
    ['a closing fence at end of file', '---\nname: real\ndescription: Valid.\n---'],
    ['a closing fence at EOF with trailing spaces', '---\nname: real\ndescription: Valid.\n---  '],
    // False rejections matter as much as false accepts: a gate that fails valid work gets
    // switched off, which lands where a gate that never fires does. Both of these were rejected
    // by the hand parser — the CRLF one would have failed any Windows contributor's file.
    ['CRLF line endings', '---\r\nname: real\r\ndescription: Valid.\r\n---\r\nb\r\n'],
    ['a quoted key', '---\n"name": real\n"description": Valid.\n---\nb\n'],
    ['a folded scalar with content', '---\nname: real\ndescription: >\n  A real folded description.\n---\nb\n'],
    ['a literal scalar with content', '---\nname: real\ndescription: |\n  A real literal description.\n---\nb\n'],
    ['extra keys beyond the required two', '---\nname: real\ndescription: Valid.\ntools: Read, Bash\n---\nb\n'],
  ])('accepts %s', (_label, body) => {
    expect(run(body)).toBe(0);
  });
});
