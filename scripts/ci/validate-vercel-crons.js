#!/usr/bin/env node
// scripts/ci/validate-vercel-crons.js
//
// Every cron in vercel.json fires on Vercel's schedule whether or not the route
// behind it does anything. Eight of them spent months forwarding to a FastAPI
// backend that had been deleted, returning 501 into the void on schedule, while
// the operator runbooks told CCW staff to curl those exact URLs to confirm the
// nightly sync had run. Nothing in CI noticed, because nothing in CI looked.
//
// Separately, twelve handlers inlined
//   authHeader !== `Bearer ${process.env.CRON_SECRET}`
// which authorises the literal header "Bearer undefined" when the variable is
// unset. That is fail-open auth on every scheduled endpoint.
//
// For each path in vercel.json's cron array this asserts:
//   1. the path is well-formed and scheduled once
//   2. a Route Handler exists at src/app/<path>/route.ts
//   3. it exports GET or POST
//   4. it authorises via cronAuthFailure(), not an inline comparison
//   5. it does not reach a 501 stub through its import graph
//
// WHAT THIS DOES NOT CATCH — stated so its green is not over-read.
// Rule 5 detects the stub SHAPES this codebase actually produces: an import of
// upstream-proxy or not-implemented-response, or a literal `status: 501`. It is
// a lint, not a proof. A status code computed at runtime (`500 + 1`), assembled
// by string concatenation, or returned from a dynamically-resolved module will
// pass. Detecting those needs execution, not parsing. Rules 1-4 ARE decisive.
//
// `node scripts/ci/validate-vercel-crons.js --self-test` proves it still rejects.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');

const STUB_MARKERS = [
  { name: 'upstream-proxy', pattern: /upstream-proxy/ },
  { name: 'requireUpstreamBase', pattern: /\brequireUpstreamBase\b/ },
  { name: 'upstreamUnavailable', pattern: /\bupstreamUnavailable\b/ },
  { name: 'notImplementedResponse', pattern: /\bnotImplementedResponse\b/ },
  { name: 'status: 501', pattern: /\bstatus\s*:\s*501\b/ },
];

/** The fail-open pattern, in any spacing. */
const INLINE_FAIL_OPEN = /!==\s*`Bearer \$\{\s*process\.env\.CRON_SECRET\s*\}`/;

/**
 * Local module specifiers, via the TypeScript parser.
 * Regexes could not tell an import from a string that reads like one; the
 * compiler can. Catches static, dynamic import() and re-exports.
 */
function localImports(source, importerPath) {
  let specifiers;
  try {
    specifiers = ts.preProcessFile(source, true, true).importedFiles.map((f) => f.fileName);
  } catch {
    return [];
  }

  const resolved = [];
  for (const specifier of specifiers) {
    const bare = specifier.split('?')[0];
    let base = null;
    if (bare.startsWith('@/')) base = path.posix.normalize(`src/${bare.slice(2)}`);
    else if (bare.startsWith('./') || bare.startsWith('../')) {
      const dir = importerPath.split('/').slice(0, -1).join('/');
      base = path.posix.normalize(path.posix.join(dir, bare));
    }
    if (base === null) continue;
    // Clamp inside src/. `../../../../outside/x` previously resolved above the
    // repository root and would have been read from disk.
    if (base !== 'src' && !base.startsWith('src/')) continue;
    resolved.push(base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`);
  }
  return resolved;
}

/** Does this module export a GET or POST handler, in any of the forms Next.js accepts? */
function exportsHandler(source) {
  let sourceFile;
  try {
    sourceFile = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
  } catch {
    return false;
  }

  let found = false;
  const isHandlerName = (name) => name === 'GET' || name === 'POST';
  const isExported = (node) =>
    node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

  const visit = (node) => {
    if (found) return;
    // export async function GET() {}
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) {
      if (isHandlerName(node.name.text)) found = true;
    }
    // export const GET = async () => {}   <- was falsely rejected before
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && isHandlerName(decl.name.text)) found = true;
      }
    }
    // export { GET } / export { handler as GET }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const el of node.exportClause.elements) {
        if (isHandlerName(el.name.text)) found = true;
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return found;
}

/** Comments and string literals removed, so markers match code, not prose. */
function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '``')
    .replace(/'(?:\\[\s\S]|[^\\'\n])*'/g, "''")
    .replace(/"(?:\\[\s\S]|[^\\"\n])*"/g, '""');
}

/** Comments only — the fail-open pattern lives in a template literal. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * Walk the route's import graph looking for a 501 stub. No depth cap — `seen`
 * guarantees termination, and a cap only guaranteed a blind spot: a reviewer
 * put a 501 seven hops away and walked straight past a limit of six.
 */
function findStubInClosure(entryPath, read) {
  const seen = new Set();
  const queue = [entryPath];

  while (queue.length > 0) {
    const filePath = queue.shift();
    if (seen.has(filePath)) continue;
    seen.add(filePath);

    const source = read(filePath);
    if (source === null) continue;

    const marker = STUB_MARKERS.find((m) => m.pattern.test(stripCommentsAndStrings(source)));
    if (marker) return { marker: marker.name, via: filePath };

    queue.push(...localImports(source, filePath));
  }
  return null;
}

/**
 * @param {{crons?: Array<{path?: string, schedule?: string}>}} config
 * @param {(relPath: string) => string | null} readSource
 * @returns {string[]} failures
 */
function validateCrons(config, readSource) {
  const failures = [];
  const crons = Array.isArray(config.crons) ? config.crons : [];
  if (crons.length === 0) return failures;

  const seen = new Set();

  for (const cron of crons) {
    const cronPath = cron && cron.path;

    if (typeof cronPath !== 'string' || !cronPath.startsWith('/api/')) {
      failures.push(`cron entry has no usable path: ${JSON.stringify(cron)}`);
      continue;
    }
    // A path containing `..` produced a read request above the repository root.
    if (cronPath.split('/').includes('..')) {
      failures.push(`${cronPath}: path traversal segment is not a valid route`);
      continue;
    }
    if (typeof cron.schedule !== 'string' || cron.schedule.trim() === '') {
      failures.push(`${cronPath}: missing schedule`);
    }
    if (seen.has(cronPath)) failures.push(`${cronPath}: scheduled more than once`);
    seen.add(cronPath);

    const relPath = path.posix.join('src/app', cronPath, 'route.ts');
    const source = readSource(relPath);

    if (source === null) {
      failures.push(`${cronPath}: scheduled, but no Route Handler at ${relPath}`);
      continue;
    }
    if (!exportsHandler(source)) {
      failures.push(`${cronPath}: ${relPath} exports neither GET nor POST`);
    }
    if (INLINE_FAIL_OPEN.test(stripComments(source))) {
      failures.push(
        `${cronPath}: ${relPath} inlines the CRON_SECRET comparison. When CRON_SECRET is ` +
          `unset that template is the literal string "Bearer undefined", so sending exactly ` +
          `that header authorises the endpoint. Use cronAuthFailure() from ` +
          `@/lib/api/cron-auth, which fails closed.`
      );
    }

    const stub = findStubInClosure(relPath, readSource);
    if (stub) {
      const where = stub.via === relPath ? 'directly' : `via ${stub.via}`;
      failures.push(
        `${cronPath}: resolves to a 501 stub (${stub.marker}, ${where}) — a scheduled ` +
          `job that cannot run. Port it to a Route Handler or remove it from vercel.json.`
      );
    }
  }

  return failures;
}

function readFromDisk(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!abs.startsWith(ROOT + path.sep)) return null; // never read outside the repo
  return fs.existsSync(abs) && fs.statSync(abs).isFile()
    ? fs.readFileSync(abs, 'utf8')
    : null;
}

function selfTest() {
  const good =
    'export async function GET(request: Request) {\n' +
    "  const unauthorized = cronAuthFailure(request);\n" +
    '  if (unauthorized) return unauthorized;\n' +
    '  return Response.json({ ok: true });\n' +
    '}';
  const P = '/api/cron/ghost';
  const R = 'src/app/api/cron/ghost/route.ts';
  const oneCron = { crons: [{ path: P, schedule: '0 19 * * *' }] };

  const mustReject = [
    { name: '501 via upstream-proxy import', files: { [R]: "import { requireUpstreamBase } from '@/lib/api/upstream-proxy';\n" + good } },
    { name: '501 via notImplementedResponse', files: { [R]: "import { notImplementedResponse } from '@/lib/integrations/not-implemented-response';\n" + good } },
    { name: 'literal status: 501', files: { [R]: 'export async function GET() { return Response.json({}, { status: 501 }); }' } },
    { name: 'status : 501 with unusual spacing', files: { [R]: 'export async function GET() { return Response.json({}, { status : 501 }); }' } },
    {
      name: '501 one hop away via a local wrapper',
      files: {
        [R]: "import { run } from '@/lib/jobs/ghost';\nexport async function GET() { return run(); }",
        'src/lib/jobs/ghost.ts': "import { upstreamUnavailable } from '@/lib/api/upstream-proxy';\nexport const run = () => upstreamUnavailable('g');",
      },
    },
    {
      name: '501 seven hops away',
      files: (() => {
        const f = { [R]: "import { h1 } from './h1';\nexport async function GET() { return h1(); }" };
        for (let i = 1; i < 7; i += 1) {
          f[`src/app/api/cron/ghost/h${i}.ts`] = `import { h${i + 1} } from './h${i + 1}';\nexport const h${i} = () => h${i + 1}();`;
        }
        f['src/app/api/cron/ghost/h7.ts'] = 'export const h7 = () => Response.json({}, { status: 501 });';
        return f;
      })(),
    },
    {
      name: '501 through a dynamic import',
      files: {
        [R]: "export async function GET() { const m = await import('./stub'); return m.run(); }",
        'src/app/api/cron/ghost/stub.ts': "import { upstreamUnavailable } from '@/lib/api/upstream-proxy';\nexport const run = () => upstreamUnavailable('g');",
      },
    },
    {
      name: '501 through a barrel re-export',
      files: {
        [R]: "import { run } from './barrel';\nexport async function GET() { return run(); }",
        'src/app/api/cron/ghost/barrel.ts': "export { run } from './impl';",
        'src/app/api/cron/ghost/impl.ts': 'export const run = () => Response.json({}, { status: 501 });',
      },
    },
    { name: 'inline fail-open CRON_SECRET comparison', files: { [R]: 'export async function GET(request) {\n  const a = request.headers.get("authorization");\n  if (a !== `Bearer ${process.env.CRON_SECRET}`) return new Response("no", { status: 401 });\n  return Response.json({ ok: true });\n}' } },
    { name: 'no GET or POST export', files: { [R]: 'export const revalidate = 0;' } },
    { name: 'no route file at all', files: {} },
  ];

  for (const c of mustReject) {
    const failures = validateCrons(oneCron, (p) =>
      Object.prototype.hasOwnProperty.call(c.files, p) ? c.files[p] : null
    );
    if (failures.length === 0) throw new Error(`self-test did not reject: ${c.name}`);
  }

  // Config-shape rejections.
  for (const [name, cfg] of [
    ['missing schedule', { crons: [{ path: P }] }],
    ['duplicate schedule', { crons: [{ path: P, schedule: '0 9 * * *' }, { path: P, schedule: '0 10 * * *' }] }],
    ['path traversal segment', { crons: [{ path: '/api/../../../../outside', schedule: '0 9 * * *' }] }],
  ]) {
    const failures = validateCrons(cfg, (p) => (p === R ? good : null));
    if (failures.length === 0) throw new Error(`self-test did not reject: ${name}`);
  }

  // Negative controls — each MUST pass, or a failure from this gate means nothing.
  const mustAccept = [
    { name: 'export async function GET', files: { [R]: good } },
    { name: 'export const GET = async', files: { [R]: 'export const GET = async (request: Request) => Response.json({ ok: true });' } },
    { name: 'export { GET }', files: { [R]: 'const GET = async () => Response.json({});\nexport { GET };' } },
    { name: 'export async function POST', files: { [R]: 'export async function POST() { return Response.json({}); }' } },
    {
      name: 'a string literal mentioning status: 501 must NOT flag',
      files: {
        [R]: "import { note } from './note';\n" + good,
        'src/app/api/cron/ghost/note.ts': "export const note = 'legacy status: 501 was returned here until 2026-08';",
      },
    },
  ];

  for (const c of mustAccept) {
    const failures = validateCrons(oneCron, (p) =>
      Object.prototype.hasOwnProperty.call(c.files, p) ? c.files[p] : null
    );
    if (failures.length > 0) {
      throw new Error(`self-test wrongly rejected: ${c.name}\n- ${failures.join('\n- ')}`);
    }
  }

  // A specifier escaping the repo must never be read.
  validateCrons(oneCron, (p) => {
    if (p === R) return "import { x } from '../../../../../../outside/secrets';\n" + good;
    if (p.includes('outside')) throw new Error(`read escaped the repo root: ${p}`);
    return null;
  });

  return { rejectedCases: mustReject.length + 3, acceptedCases: mustAccept.length };
}

function main() {
  if (process.argv[2] === '--self-test') {
    const r = selfTest();
    console.log(
      `Vercel cron validator self-test passed: rejected=${r.rejectedCases} accepted=${r.acceptedCases}`
    );
    return 0;
  }

  console.log('\n🔍 Validating vercel.json cron registrations...\n');

  const configPath = path.join(ROOT, 'vercel.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ vercel.json not found');
    return 1;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const failures = validateCrons(config, readFromDisk);
  const count = Array.isArray(config.crons) ? config.crons.length : 0;

  if (failures.length > 0) {
    failures.forEach((f) => console.error(`  ❌ ${f}`));
    console.error(`\nChecked ${count} cron(s). ❌ ${failures.length} error(s)\n`);
    return 1;
  }

  config.crons.forEach((c) => console.log(`  ✅ ${c.path} (${c.schedule})`));
  console.log(`\nChecked ${count} cron(s). ✅ All resolve to live Route Handlers\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { validateCrons, selfTest };
