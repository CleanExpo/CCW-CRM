#!/usr/bin/env node
// scripts/ci/validate-css-sources.js
//
// src/styles/design-system.css sat in this repo for months declaring a teal
// primary colour and a "NO Lucide icons" rule, while nothing imported it, the
// real primary was blue, and 282 files imported lucide-react. Its rules were
// quoted in review as though they applied. Nothing caught it because nothing
// checked whether a stylesheet was reachable.
//
// This asserts every CSS file under src/ is reachable from the entry
// stylesheet, either by a TS/TSX import or by an @import chain. An unreachable
// stylesheet is not dead weight — it is a second, silent source of truth about
// what the product looks like.
//
// `node scripts/ci/validate-css-sources.js --self-test` proves it still rejects.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const ENTRY = 'src/app/globals.css';

/** Every .css file under src/, as repo-relative posix paths. */
function findCssFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      findCssFiles(full, acc);
    } else if (entry.name.endsWith('.css')) {
      acc.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  }
  return acc;
}

/** Repo-relative paths of every file that could reference a stylesheet. */
function findSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      findSourceFiles(full, acc);
    } else if (/\.(ts|tsx|js|jsx|css|mjs)$/.test(entry.name)) {
      acc.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  }
  return acc;
}

/**
 * @param {string[]} cssFiles repo-relative css paths
 * @param {string[]} sourceFiles repo-relative source paths
 * @param {(p: string) => string | null} read
 * @returns {string[]} failures
 */
/** Remove block and line comments so a mention inside one cannot count as an import. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * Quoted specifiers from genuine import forms only:
 *   import './x.css'      import x from '@/styles/x.css'
 *   require('./x.css')    @import './x.css'    @import url('./x.css')
 */
function extractSpecifiers(source) {
  const cleaned = stripComments(source);
  const specifiers = [];
  // Anchored at line start (multiline flag), because a real import is a
  // statement. Without the anchor, an ordinary string such as
  //   const doc = "import './orphan.css' to enable the theme";
  // counted as an import and made an orphan pass — an independent reviewer
  // demonstrated that with both a quoted string and a template literal.
  const patterns = [
    /^\s*import\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*export\s+(?:\*|{[^}]*})\s+from\s+['"]([^'"]+)['"]/gm,
    /^\s*(?:const|let|var)?\s*\w*\s*=?\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
    /^\s*@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/gm,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(cleaned)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * Files that must not act as reachability roots.
 *
 * A stylesheet imported only by a test does not reach the browser. The first
 * version treated every non-CSS file as a production root, so importing an
 * orphan from a `.test.ts` was enough to make it pass.
 */
function isProductionRoot(filePath) {
  if (filePath.endsWith('.css')) return false;
  return !/(^|\/)(__tests__|__mocks__|e2e)\//.test(filePath) &&
    !/\.(test|spec)\.[jt]sx?$/.test(filePath) &&
    !/(^|\/)test-setup\.[jt]s$/.test(filePath);
}

/** Resolve a specifier to a repo-relative posix path, or null if not a local file. */
function resolveSpecifier(specifier, importerPath) {
  const bare = specifier.split('?')[0];
  if (bare.startsWith('@/')) return path.posix.normalize(`src/${bare.slice(2)}`);
  if (bare.startsWith('./') || bare.startsWith('../')) {
    const importerDir = importerPath.split('/').slice(0, -1).join('/');
    return path.posix.normalize(path.posix.join(importerDir, bare));
  }
  return null; // bare package specifier — node_modules, not ours
}

/**
 * A stylesheet is reachable only if some file actually imports it by resolved
 * path, transitively through CSS @import chains. Matching a basename anywhere
 * in a line is NOT sufficient: a comment naming the file would satisfy it, and
 * an independent reviewer demonstrated exactly that bypass against the first
 * version of this check.
 *
 * @param {string[]} cssFiles repo-relative css paths
 * @param {string[]} sourceFiles repo-relative source paths
 * @param {(p: string) => string | null} read
 * @returns {string[]} failures
 */
function validateCssSources(cssFiles, sourceFiles, read) {
  const failures = [];

  if (!cssFiles.includes(ENTRY)) {
    failures.push(`entry stylesheet missing: ${ENTRY}`);
    return failures;
  }

  const cssSet = new Set(cssFiles);

  // Edge: importer -> resolved stylesheet targets it genuinely imports.
  const importsByFile = new Map();
  for (const sourceFile of sourceFiles) {
    const contents = read(sourceFile);
    if (contents === null) continue;
    const targets = extractSpecifiers(contents)
      .map((specifier) => resolveSpecifier(specifier, sourceFile))
      .filter((resolved) => resolved !== null && cssSet.has(resolved));
    importsByFile.set(sourceFile, targets);
  }

  // Seed: stylesheets imported from a NON-css file (a component or layout).
  // Then walk CSS @import chains outward from those.
  const reachable = new Set();
  const queue = [];
  for (const [sourceFile, targets] of importsByFile) {
    if (!isProductionRoot(sourceFile)) continue;
    for (const target of targets) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }
  while (queue.length > 0) {
    const current = queue.shift();
    for (const target of importsByFile.get(current) || []) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }

  if (!reachable.has(ENTRY)) {
    failures.push(
      `${ENTRY}: the entry stylesheet itself is not imported by any component. ` +
        `Nothing in it reaches the browser.`
    );
  }

  for (const cssFile of cssFiles) {
    if (reachable.has(cssFile)) continue;
    failures.push(
      `${cssFile}: nothing imports it by path, so nothing in it reaches the browser. ` +
        `Delete it, or import it from ${ENTRY}. A stylesheet that looks authoritative ` +
        `but never loads is a second source of truth about the design.`
    );
  }

  return failures;
}

function readFromDisk(relPath) {
  const abs = path.join(ROOT, relPath);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

function selfTest() {
  const entryContents = '@import "tailwindcss" source(none);\n:root { --brand-primary: 221 83% 53%; }';

  // Must REJECT: an orphaned stylesheet, which is the exact defect that shipped.
  const orphanFailures = validateCssSources(
    [ENTRY, 'src/styles/design-system.css'],
    [ENTRY, 'src/styles/design-system.css', 'src/app/layout.tsx'],
    (p) => {
      if (p === ENTRY) return entryContents;
      if (p === 'src/styles/design-system.css') return ':root { --primary: #0D9488; }';
      if (p === 'src/app/layout.tsx') return "import './globals.css';";
      return null;
    }
  );
  if (orphanFailures.length === 0) throw new Error('self-test did not reject: orphaned stylesheet');

  // Must REJECT: the reviewer's demonstrated bypass. The first version of this
  // check matched a basename anywhere in an import-like line, so a comment
  // merely NAMING the orphan made it pass. Keep this case forever.
  const commentBypassFailures = validateCssSources(
    [ENTRY, 'src/styles/reviewer-orphan.css'],
    [ENTRY, 'src/styles/reviewer-orphan.css', 'src/app/layout.tsx'],
    (p) => {
      if (p === ENTRY) {
        return `${entryContents}\n/* Reviewer note: do not import reviewer-orphan.css here. */`;
      }
      if (p === 'src/styles/reviewer-orphan.css') return '.orphan { color: red; }';
      if (p === 'src/app/layout.tsx') return "import './globals.css';";
      return null;
    }
  );
  if (commentBypassFailures.length === 0) {
    throw new Error('self-test did not reject: orphan named only in a comment');
  }

  // Must REJECT: a stylesheet whose basename matches an imported one in a
  // different directory. Basename matching would have let this ride along.
  const basenameCollisionFailures = validateCssSources(
    [ENTRY, 'src/features/a/theme.css', 'src/features/b/theme.css'],
    [ENTRY, 'src/features/a/theme.css', 'src/features/b/theme.css', 'src/app/layout.tsx'],
    (p) => {
      if (p === ENTRY) return entryContents;
      if (p === 'src/app/layout.tsx') {
        return "import './globals.css';\nimport '@/features/a/theme.css';";
      }
      if (p.endsWith('theme.css')) return '.t { color: blue; }';
      return null;
    }
  );
  if (!basenameCollisionFailures.some((f) => f.startsWith('src/features/b/theme.css'))) {
    throw new Error('self-test did not reject: same-basename stylesheet in another directory');
  }

  // Must REJECT: reviewer bypass — an ordinary string that merely looks like an
  // import statement.
  for (const [label, line] of [
    ['quoted string', `const doc = "import './fake.css' to enable the theme";`],
    ['template literal', 'const doc = `import \'./fake.css\' here`;'],
  ]) {
    const failures = validateCssSources(
      [ENTRY, 'src/styles/fake.css'],
      [ENTRY, 'src/styles/fake.css', 'src/app/layout.tsx', 'src/app/doc.ts'],
      (p) => {
        if (p === ENTRY) return entryContents;
        if (p === 'src/styles/fake.css') return '.f { color: red; }';
        if (p === 'src/app/layout.tsx') return "import './globals.css';";
        if (p === 'src/app/doc.ts') return line;
        return null;
      }
    );
    if (failures.length === 0) throw new Error(`self-test did not reject: ${label} posing as import`);
  }

  // Must REJECT: reviewer bypass — an orphan imported only by a test. A
  // stylesheet a test imports still does not reach the browser.
  const testOnlyFailures = validateCssSources(
    [ENTRY, 'src/styles/test-only.css'],
    [ENTRY, 'src/styles/test-only.css', 'src/app/layout.tsx', 'src/app/probe.test.ts'],
    (p) => {
      if (p === ENTRY) return entryContents;
      if (p === 'src/styles/test-only.css') return '.t { color: red; }';
      if (p === 'src/app/layout.tsx') return "import './globals.css';";
      if (p === 'src/app/probe.test.ts') return "import '@/styles/test-only.css';";
      return null;
    }
  );
  if (testOnlyFailures.length === 0) {
    throw new Error('self-test did not reject: stylesheet imported only by a test');
  }

  // Must REJECT: a cycle of orphans with no production root.
  const cycleFailures = validateCssSources(
    [ENTRY, 'src/styles/a.css', 'src/styles/b.css'],
    [ENTRY, 'src/styles/a.css', 'src/styles/b.css', 'src/app/layout.tsx'],
    (p) => {
      if (p === ENTRY) return entryContents;
      if (p === 'src/app/layout.tsx') return "import './globals.css';";
      if (p === 'src/styles/a.css') return "@import './b.css';";
      if (p === 'src/styles/b.css') return "@import './a.css';";
      return null;
    }
  );
  if (cycleFailures.length < 2) {
    throw new Error('self-test did not reject: orphan-only CSS cycle');
  }

  // Must REJECT: a missing entry stylesheet.
  const missingEntryFailures = validateCssSources(['src/other.css'], ['src/other.css'], () => '');
  if (missingEntryFailures.length === 0) {
    throw new Error('self-test did not reject: missing entry stylesheet');
  }

  // Must ACCEPT: an imported stylesheet, or the check rejects everything and a
  // failure from it would carry no information.
  const soundFailures = validateCssSources(
    [ENTRY, 'src/styles/print.css'],
    [ENTRY, 'src/styles/print.css', 'src/app/layout.tsx'],
    (p) => {
      if (p === ENTRY) return entryContents;
      if (p === 'src/styles/print.css') return '@media print { body { color: #000; } }';
      if (p === 'src/app/layout.tsx') return "import './globals.css';\nimport '@/styles/print.css';";
      return null;
    }
  );
  if (soundFailures.length > 0) {
    throw new Error(`self-test rejected a sound tree:\n- ${soundFailures.join('\n- ')}`);
  }

  return { rejectedCases: 8, acceptedCases: 1 };
}

function main() {
  if (process.argv[2] === '--self-test') {
    const result = selfTest();
    console.log(
      `CSS source validator self-test passed: rejected=${result.rejectedCases} accepted=${result.acceptedCases}`
    );
    return 0;
  }

  console.log('\n🔍 Validating every stylesheet under src/ is reachable...\n');

  const cssFiles = findCssFiles(SRC);
  const sourceFiles = findSourceFiles(SRC);
  const failures = validateCssSources(cssFiles, sourceFiles, readFromDisk);

  if (failures.length > 0) {
    failures.forEach((f) => console.error(`  ❌ ${f}`));
    console.error(`\nChecked ${cssFiles.length} stylesheet(s). ❌ ${failures.length} error(s)\n`);
    return 1;
  }

  cssFiles.forEach((f) => console.log(`  ✅ ${f}`));
  console.log(`\nChecked ${cssFiles.length} stylesheet(s). ✅ All reachable\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { validateCssSources, selfTest };
