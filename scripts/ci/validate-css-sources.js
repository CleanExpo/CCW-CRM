#!/usr/bin/env node
// scripts/ci/validate-css-sources.js
//
// src/styles/design-system.css sat in this repo for months declaring a teal
// primary colour and a "NO Lucide icons" rule, while nothing imported it, the
// real primary was blue, and 282 files imported lucide-react. Its rules were
// quoted in review as though they applied. Nothing caught it because nothing
// checked whether a stylesheet was reachable.
//
// WHY THIS USES THE TYPESCRIPT PARSER
//
// Two earlier versions matched imports with regexes and an independent reviewer
// defeated both. Basename matching let a COMMENT naming the file count as an
// import. Line-anchored regexes then let a multi-line TEMPLATE LITERAL count,
// while falsely flagging legitimate same-line and dynamic imports. Regexes
// cannot tell an import statement from text that looks like one; the compiler
// can. `ts.preProcessFile` returns exactly the module specifiers TypeScript
// itself resolves — static, dynamic, and re-exports — and nothing else.
//
// REACHABILITY IS FROM THE ENTRY POINTS, NOT FROM "ANY FILE"
//
// Treating every non-CSS file as a root meant a stylesheet imported only by a
// test, a Storybook story, a config file, or by another dead module counted as
// reachable. Reachability is now a walk from the Next.js entry points, so a
// stylesheet only reachable through dead code is correctly reported dead.
//
// `node scripts/ci/validate-css-sources.js --self-test` proves it still rejects.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const ENTRY = 'src/app/globals.css';

/**
 * Entry points that can actually deliver CSS to a browser.
 *
 * `route.ts` and `middleware.ts` are server entry points — they return JSON or
 * a redirect and render nothing, so a stylesheet reachable only from one of them
 * still never loads. Seeding them made two orphans pass.
 */
const ENTRY_POINT =
  /^src\/app\/(.*\/)?(layout|page|template|default|error|loading|not-found|forbidden|unauthorized)\.[jt]sx?$/;

/** `global-error` is only a convention at the app root. */
const ROOT_ONLY_ENTRY = /^src\/app\/global-error\.[jt]sx?$/;

function isEntryPoint(filePath) {
  // Next.js treats a path segment beginning with `_` as a PRIVATE folder and
  // never routes it, so a page there renders for nobody. Seeding it as a root
  // let an orphan under src/app/_anything/ pass — demonstrated on the real tree.
  if (filePath.split('/').some((segment) => segment.startsWith('_'))) return false;
  return ENTRY_POINT.test(filePath) || ROOT_ONLY_ENTRY.test(filePath);
}

/** Module specifiers this file genuinely imports. */
function extractImports(filePath, source) {
  if (filePath.endsWith('.css')) {
    // CSS has no string-literal ambiguity, but strip comments anyway.
    const cleaned = source.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const specifiers = [];
    // Quoted form, plus the valid UNQUOTED `@import url(./x.css);` which was
    // previously missed and would have reported a loaded stylesheet as orphaned.
    const patterns = [
      /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g,
      /@import\s+url\(\s*([^'")\s]+)\s*\)/g,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(cleaned)) !== null) specifiers.push(match[1]);
    }
    return specifiers;
  }
  // detectJavaScriptImports=true, readImportFiles=true — catches static,
  // dynamic import(), and re-exports. A string that merely reads like an
  // import is not one, and this is what knows the difference.
  const specifiers = ts.preProcessFile(source, true, true).importedFiles.map((f) => f.fileName);

  // preProcessFile cannot resolve a computed specifier such as
  // import(`./themes/${name}.css`), so a stylesheet loaded that way was reported
  // orphaned — verified against a real webpack build that did emit its CSS.
  // Rather than guess the value, treat the STATIC PREFIX as a wildcard: any
  // stylesheet under that directory counts as reachable. Deliberately
  // conservative. A false "this is dead" is worse than a missed orphan here,
  // because acting on it deletes a stylesheet that is genuinely loaded.
  // Comments and QUOTED strings are removed first. Running this on raw source
  // let a comment or an ordinary string forge reachability, reintroducing the
  // very ambiguity the header above disclaims. Template literals are kept,
  // because the construct being detected IS a template literal.
  const scannable = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:\\[\s\S]|[^\\'\n])*'/g, "''")
    .replace(/"(?:\\[\s\S]|[^\\"\n])*"/g, '""');
  const computed = /import\s*\(\s*`([^`$]*)\$\{/g;
  let match;
  while ((match = computed.exec(scannable)) !== null) {
    const prefix = match[1];
    if (prefix.startsWith('./') || prefix.startsWith('../') || prefix.startsWith('@/')) {
      specifiers.push(`${prefix}*`);
    }
  }
  return specifiers;
}

/**
 * Resolve to a repo-relative posix path inside src/, or null.
 * Anything escaping src/ is dropped rather than read — a specifier such as
 * `../../../../outside/x` previously resolved above the repository root.
 */
function resolveSpecifier(specifier, importerPath) {
  const bare = specifier.split('?')[0];
  let resolved = null;
  if (bare.startsWith('@/')) resolved = path.posix.normalize(`src/${bare.slice(2)}`);
  else if (bare.startsWith('./') || bare.startsWith('../')) {
    const dir = importerPath.split('/').slice(0, -1).join('/');
    resolved = path.posix.normalize(path.posix.join(dir, bare));
  }
  if (resolved === null) return null;
  if (resolved !== 'src' && !resolved.startsWith('src/')) return null;
  return resolved;
}

/**
 * Candidate on-disk paths for a resolved specifier.
 * `.mjs` and the JavaScript directory indexes were missing, so a stylesheet
 * loaded through any of those shapes was falsely reported orphaned.
 */
function candidatePaths(resolved) {
  if (/\.(css|tsx?|jsx?|mjs)$/.test(resolved)) return [resolved];
  return [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    `${resolved}.mjs`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
    `${resolved}/index.js`,
    `${resolved}/index.jsx`,
    `${resolved}/index.mjs`,
  ];
}

/**
 * @param {string[]} cssFiles repo-relative css paths
 * @param {string[]} sourceFiles repo-relative source paths (all files, incl. css)
 * @param {(p: string) => string | null} read
 * @returns {string[]} failures
 */
function validateCssSources(cssFiles, sourceFiles, read) {
  const failures = [];

  if (!cssFiles.includes(ENTRY)) {
    failures.push(`entry stylesheet missing: ${ENTRY}`);
    return failures;
  }

  const known = new Set(sourceFiles);
  const reachable = new Set();
  const queue = sourceFiles.filter(isEntryPoint);

  if (queue.length === 0) {
    failures.push(
      'no Next.js entry point found (layout/page/route/middleware) — reachability cannot be computed'
    );
    return failures;
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (reachable.has(current)) continue;
    reachable.add(current);

    const source = read(current);
    if (source === null) continue;

    for (const specifier of extractImports(current, source)) {
      // Wildcard from a computed dynamic import — everything under the static
      // prefix is treated as reachable.
      if (specifier.endsWith('*')) {
        const prefix = resolveSpecifier(specifier.slice(0, -1), current);
        if (prefix === null) continue;
        for (const candidate of known) {
          if (candidate.startsWith(prefix) && !reachable.has(candidate)) queue.push(candidate);
        }
        continue;
      }
      const resolved = resolveSpecifier(specifier, current);
      if (resolved === null) continue;
      for (const candidate of candidatePaths(resolved)) {
        if (known.has(candidate) && !reachable.has(candidate)) queue.push(candidate);
      }
    }
  }

  for (const cssFile of cssFiles) {
    if (reachable.has(cssFile)) continue;
    failures.push(
      `${cssFile}: no entry point reaches it, so nothing in it reaches the browser. ` +
        `Delete it, or import it from ${ENTRY}. A stylesheet that looks authoritative ` +
        `but never loads is a second source of truth about the design.`
    );
  }

  return failures;
}

function walk(dir, test, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, test, acc);
    } else if (test(entry.name)) {
      acc.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  }
  return acc;
}

function readFromDisk(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!abs.startsWith(ROOT + path.sep)) return null; // never read outside the repo
  return fs.existsSync(abs) && fs.statSync(abs).isFile()
    ? fs.readFileSync(abs, 'utf8')
    : null;
}

/**
 * Positive controls.
 *
 * Every fixture path below is consistent: the stylesheet a fixture imports is
 * the stylesheet the fixture declares. An earlier revision imported
 * './fake.css' from src/app/doc.ts — which resolves to src/app/fake.css — while
 * declaring src/styles/fake.css, so the case passed no matter what the code did.
 * A reviewer proved it by reverting the repair and watching --self-test stay
 * green. Keep fixture paths aligned, or this file is decoration.
 */
function selfTest() {
  const LAYOUT = 'src/app/layout.tsx';
  const entryCss = '@import "tailwindcss" source(none);\n:root { --brand-primary: 221 83% 53%; }';
  const layoutSrc = "import './globals.css';\nexport default function L() { return null; }";

  const mustReject = [
    {
      name: 'orphaned stylesheet (the defect that shipped)',
      files: { [ENTRY]: entryCss, [LAYOUT]: layoutSrc, 'src/styles/design-system.css': ':root{}' },
      orphan: 'src/styles/design-system.css',
    },
    {
      name: 'orphan named only in a comment',
      files: {
        [ENTRY]: `${entryCss}\n/* do not import reviewer-orphan.css here */`,
        [LAYOUT]: layoutSrc,
        'src/styles/reviewer-orphan.css': '.o{}',
      },
      orphan: 'src/styles/reviewer-orphan.css',
    },
    {
      name: 'orphan named inside an ordinary string',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: `${layoutSrc}\nconst doc = "import '@/styles/str.css' to enable";`,
        'src/styles/str.css': '.s{}',
      },
      orphan: 'src/styles/str.css',
    },
    {
      name: 'orphan named inside a multi-line template literal',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: `${layoutSrc}\nconst t = \`line one\nimport '@/styles/tpl.css'\nline three\`;`,
        'src/styles/tpl.css': '.t{}',
      },
      orphan: 'src/styles/tpl.css',
    },
    {
      name: 'orphan imported only by a test',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: layoutSrc,
        'src/styles/test-only.css': '.t{}',
        'src/app/probe.test.ts': "import '@/styles/test-only.css';",
      },
      orphan: 'src/styles/test-only.css',
    },
    {
      name: 'orphan imported only by a Storybook story',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: layoutSrc,
        'src/styles/story-only.css': '.s{}',
        'src/components/X.stories.tsx': "import '@/styles/story-only.css';",
      },
      orphan: 'src/styles/story-only.css',
    },
    {
      name: 'orphan imported only by an unreachable module',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: layoutSrc,
        'src/styles/dead-only.css': '.d{}',
        'src/lib/dead.ts': "import '@/styles/dead-only.css';",
      },
      orphan: 'src/styles/dead-only.css',
    },
    {
      // route.ts and middleware render nothing — a stylesheet reachable only
      // from a server entry point still never loads in a browser.
      name: 'orphan imported only by an API route handler',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: layoutSrc,
        'src/styles/api-only.css': '.a{}',
        'src/app/api/probe/route.ts': "import '@/styles/api-only.css';\nexport async function GET() {}",
      },
      orphan: 'src/styles/api-only.css',
    },
    {
      name: 'orphan imported only by middleware',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: layoutSrc,
        'src/styles/mw-only.css': '.m{}',
        'src/middleware.ts': "import '@/styles/mw-only.css';\nexport function middleware() {}",
      },
      orphan: 'src/styles/mw-only.css',
    },
    {
      // Next.js never routes a folder whose segment starts with '_', so a page
      // there renders for nobody. Demonstrated on the real tree.
      name: 'orphan imported only by a page in a Next.js private folder',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: layoutSrc,
        'src/styles/private-orphan.css': '.p{}',
        'src/app/_private/page.tsx': "import '@/styles/private-orphan.css';\nexport default () => null;",
      },
      orphan: 'src/styles/private-orphan.css',
    },
    {
      name: 'orphan-only CSS cycle with no entry point reaching it',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: layoutSrc,
        'src/styles/a.css': "@import './b.css';",
        'src/styles/b.css': "@import './a.css';",
      },
      orphan: 'src/styles/a.css',
    },
  ];

  for (const testCase of mustReject) {
    const all = Object.keys(testCase.files);
    const css = all.filter((f) => f.endsWith('.css'));
    const failures = validateCssSources(css, all, (p) =>
      Object.prototype.hasOwnProperty.call(testCase.files, p) ? testCase.files[p] : null
    );
    if (!failures.some((f) => f.startsWith(testCase.orphan))) {
      throw new Error(
        `self-test did not reject: ${testCase.name} (expected a failure naming ${testCase.orphan}, got ${
          failures.length ? failures.join('; ') : 'none'
        })`
      );
    }
  }

  // Negative controls. A legitimately imported stylesheet must never be flagged,
  // in any of the import forms real code uses — the line-anchored regex version
  // falsely flagged the same-line and dynamic cases.
  const mustAccept = [
    {
      name: 'plain side-effect import from the layout',
      files: { [ENTRY]: entryCss, [LAYOUT]: layoutSrc },
    },
    {
      name: 'same-line static import after other tokens',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: `${layoutSrc}\nimport '@/styles/same-line.css';`,
        'src/styles/same-line.css': '.x{}',
      },
    },
    {
      name: 'dynamic import',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: `${layoutSrc}\nexport const load = () => import('@/styles/dyn.css');`,
        'src/styles/dyn.css': '.d{}',
      },
    },
    {
      name: 'reached through a CSS @import chain',
      files: {
        [ENTRY]: `${entryCss}\n@import './theme.css';`,
        [LAYOUT]: layoutSrc,
        'src/app/theme.css': '.th{}',
      },
    },
    {
      name: 'reached through a component the layout imports',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: `${layoutSrc}\nimport '@/components/Shell';`,
        'src/components/Shell.tsx': "import '@/styles/shell.css';\nexport default () => null;",
        'src/styles/shell.css': '.sh{}',
      },
    },
    {
      name: 'reached through an extensionless .mjs module',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: `${layoutSrc}\nimport '@/lib/theme';`,
        'src/lib/theme.mjs': "import '@/styles/mjs.css';\nexport const t = 1;",
        'src/styles/mjs.css': '.m{}',
      },
    },
    {
      name: 'reached through a JavaScript directory index',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: `${layoutSrc}\nimport '@/lib/widgets';`,
        'src/lib/widgets/index.js': "import '@/styles/widgets.css';\nexport const w = 1;",
        'src/styles/widgets.css': '.w{}',
      },
    },
    {
      name: 'reached through an unquoted @import url()',
      files: {
        [ENTRY]: `${entryCss}\n@import url(./unquoted.css);`,
        [LAYOUT]: layoutSrc,
        'src/app/unquoted.css': '.u{}',
      },
    },
    {
      // A computed dynamic import cannot be resolved statically; treating the
      // static prefix as a wildcard keeps genuinely-loaded stylesheets from
      // being reported dead. Verified against a real webpack build.
      name: 'stylesheet loaded through a computed dynamic import',
      files: {
        [ENTRY]: entryCss,
        [LAYOUT]: `${layoutSrc}\nconst load = (n) => import(\`@/styles/themes/${'${n}'}.css\`);`,
        'src/styles/themes/dark.css': '.d{}',
      },
    },
    {
      name: 'entry point inside a route group',
      files: {
        [ENTRY]: entryCss,
        'src/app/(marketing)/layout.tsx': "import '@/app/globals.css';\nexport default () => null;",
      },
    },
  ];

  for (const testCase of mustAccept) {
    const all = Object.keys(testCase.files);
    const css = all.filter((f) => f.endsWith('.css'));
    const failures = validateCssSources(css, all, (p) =>
      Object.prototype.hasOwnProperty.call(testCase.files, p) ? testCase.files[p] : null
    );
    if (failures.length > 0) {
      throw new Error(`self-test wrongly rejected: ${testCase.name}\n- ${failures.join('\n- ')}`);
    }
  }

  // A specifier escaping the repo must never be read from disk.
  validateCssSources(
    [ENTRY],
    [ENTRY, LAYOUT],
    (p) => {
      if (p === ENTRY) return entryCss;
      if (p === LAYOUT) return `${layoutSrc}\nimport '../../../../../outside/secrets';`;
      throw new Error(`read escaped the repo: ${p}`);
    }
  );

  return { rejectedCases: mustReject.length, acceptedCases: mustAccept.length };
}

function main() {
  if (process.argv[2] === '--self-test') {
    const result = selfTest();
    console.log(
      `CSS source validator self-test passed: rejected=${result.rejectedCases} accepted=${result.acceptedCases}`
    );
    return 0;
  }

  console.log('\n🔍 Validating every stylesheet under src/ is reachable from an entry point...\n');

  const cssFiles = walk(SRC, (n) => n.endsWith('.css'));
  const sourceFiles = walk(SRC, (n) => /\.(css|tsx?|jsx?|mjs)$/.test(n));
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
