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
function validateCssSources(cssFiles, sourceFiles, read) {
  const failures = [];

  if (!cssFiles.includes(ENTRY)) {
    failures.push(`entry stylesheet missing: ${ENTRY}`);
    return failures;
  }

  for (const cssFile of cssFiles) {
    if (cssFile === ENTRY) continue;

    const basename = cssFile.split('/').pop();
    // A stylesheet counts as reached if any other file mentions it by name in
    // an import. Matching on basename keeps this robust to '@/styles/x.css',
    // './x.css' and '../../styles/x.css' all meaning the same file.
    const referenced = sourceFiles.some((sourceFile) => {
      if (sourceFile === cssFile) return false;
      const contents = read(sourceFile);
      if (contents === null) return false;
      return new RegExp(`(?:import|@import|require)[^\\n]*${basename.replace('.', '\\.')}`).test(
        contents
      );
    });

    if (!referenced) {
      failures.push(
        `${cssFile}: no file imports it, so nothing in it reaches the browser. ` +
          `Delete it, or import it from ${ENTRY}. A stylesheet that looks authoritative ` +
          `but never loads is a second source of truth about the design.`
      );
    }
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

  return { rejectedCases: 2, acceptedCases: 1 };
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
