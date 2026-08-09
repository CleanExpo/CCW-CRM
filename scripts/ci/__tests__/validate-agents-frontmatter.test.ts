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
  ])('rejects %s', (_label, body) => {
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
    ['trailing spaces on the fence', '---\nname: real\ndescription: Valid.\n---   \nb\n'],
  ])('accepts %s', (_label, body) => {
    expect(run(body)).toBe(0);
  });
});
