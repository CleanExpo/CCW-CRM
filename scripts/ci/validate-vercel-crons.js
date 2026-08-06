#!/usr/bin/env node
// scripts/ci/validate-vercel-crons.js
//
// Every cron in vercel.json fires on Vercel's schedule whether or not the route
// behind it does anything. Eight of them spent months forwarding to a FastAPI
// backend that had been deleted, returning 501 into the void on schedule, while
// the operator runbooks told CCW staff to curl those exact URLs to confirm the
// nightly sync had run. Nothing in CI noticed, because nothing in CI looked.
//
// This looks. For every path in vercel.json's cron array it asserts:
//   1. a Route Handler exists at src/app/<path>/route.ts
//   2. that handler exports GET or POST
//   3. that handler does not resolve to a 501 stub (upstream-proxy /
//      notImplementedResponse), which is the shape a dead cron takes here
//
// Run `node scripts/ci/validate-vercel-crons.js --self-test` to prove the check
// can still fail. A validator that has never been seen rejecting anything is
// indistinguishable from a validator that always passes.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/**
 * Markers that mean "this handler cannot do its job in this deployment".
 * Regexes, not substrings: `{ status : 501 }` with unusual spacing slipped past
 * the literal-string version, and an independent reviewer demonstrated it.
 */
const STUB_MARKERS = [
  { name: 'upstream-proxy', pattern: /upstream-proxy/ },
  { name: 'requireUpstreamBase', pattern: /\brequireUpstreamBase\b/ },
  { name: 'upstreamUnavailable', pattern: /\bupstreamUnavailable\b/ },
  { name: 'notImplementedResponse', pattern: /\bnotImplementedResponse\b/ },
  { name: 'status: 501', pattern: /\bstatus\s*:\s*501\b/ },
];

/**
 * Remove comments AND string literals.
 *
 * Comments were already stripped so a marker inside one could not trip the
 * check. String literals matter for the opposite reason: the reviewer showed a
 * harmless module containing the string "legacy status: 501" being REJECTED, a
 * false positive. A gate that cries wolf gets ignored, which is the same
 * failure mode as one that stays silent.
 */
function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '``')
    .replace(/'(?:\\[\s\S]|[^\\'\n])*'/g, "''")
    .replace(/"(?:\\[\s\S]|[^\\"\n])*"/g, '""');
}

/** Comments only — used where quoted module specifiers must survive. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** Local module specifiers imported by this file, resolved to repo-relative paths. */
function localImports(source, importerPath) {
  const cleaned = stripComments(source);
  const specifiers = [];
  const patterns = [
    /\bimport\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:\*|{[^}]*})\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Dynamic import — a 501 reached through `await import('./stub')` escaped
    // the first graph walk entirely.
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(cleaned)) !== null) specifiers.push(match[1]);
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
    // Clamp inside src/. `../../../outside/x` resolved to a path above the repo
    // root, which the disk reader would then have happily opened.
    if (base !== 'src' && !base.startsWith('src/')) continue;
    // Try the usual TS resolution shapes.
    resolved.push(base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`);
  }
  return resolved;
}

/**
 * Walk the route's local import graph looking for a 501 stub.
 *
 * Scanning only the route file is not enough: an independent reviewer showed
 * that a scheduled route calling a thin local wrapper — where the wrapper is
 * what calls upstreamUnavailable() — passed the first version of this check
 * while still returning HTTP 501 on every run. The defect this gate exists to
 * catch was reachable one hop away from where it was looking.
 *
 * @returns {{marker: string, via: string} | null}
 */
function findStubInClosure(entryPath, read) {
  const seen = new Set();
  const queue = [entryPath];

  // No depth cap. The first version stopped at six hops, and the reviewer put a
  // 501 seven hops away and walked straight past. `seen` already guarantees
  // termination — a depth limit only guaranteed a blind spot.
  while (queue.length > 0) {
    const filePath = queue.shift();
    if (seen.has(filePath)) continue;
    seen.add(filePath);

    const source = read(filePath);
    if (source === null) continue;

    const forMarkers = stripCommentsAndStrings(source);
    const marker = STUB_MARKERS.find((m) => m.pattern.test(forMarkers));
    if (marker) return { marker: marker.name, via: filePath };

    queue.push(...localImports(source, filePath));
  }
  return null;
}

/**
 * Scheduled handlers must authorise through the shared guard.
 *
 * Twelve handlers each inlined `authHeader !== \`Bearer ${process.env.CRON_SECRET}\``,
 * which authorises the literal header "Bearer undefined" whenever CRON_SECRET is
 * unset. That is a fail-open auth check on every scheduled endpoint, and it was
 * copy-pasted, so the only durable fix is one guard plus this check.
 */
const INLINE_FAIL_OPEN = /!==\s*`Bearer \$\{\s*process\.env\.CRON_SECRET\s*\}`/;

function findInlineAuth(routePath, read) {
  const source = read(routePath);
  if (source === null) return false;
  return INLINE_FAIL_OPEN.test(stripComments(source));
}

/**
 * @param {{crons?: Array<{path?: string, schedule?: string}>}} config
 * @param {(relPath: string) => string | null} readSource
 * @returns {string[]} failures — empty means the config is sound
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
    if (typeof cron.schedule !== 'string' || cron.schedule.trim() === '') {
      failures.push(`${cronPath}: missing schedule`);
    }
    if (seen.has(cronPath)) {
      failures.push(`${cronPath}: scheduled more than once`);
    }
    seen.add(cronPath);

    const relPath = path.posix.join('src/app', cronPath, 'route.ts');
    const source = readSource(relPath);

    if (source === null) {
      failures.push(`${cronPath}: scheduled, but no Route Handler at ${relPath}`);
      continue;
    }
    if (!/export\s+(?:async\s+)?function\s+(?:GET|POST)\b/.test(source)) {
      failures.push(`${cronPath}: ${relPath} exports neither GET nor POST`);
    }

    if (findInlineAuth(relPath, readSource)) {
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
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

/**
 * Positive control. Each case must be REJECTED; a case that passes means the
 * check has stopped discriminating and its clean verdict is worthless.
 */
function selfTest() {
  const good = 'export async function GET(request: Request) { return new Response("ok"); }';

  const cases = [
    {
      name: '501 stub via upstream-proxy',
      config: { crons: [{ path: '/api/cron/ghost', schedule: '0 19 * * *' }] },
      sources: {
        'src/app/api/cron/ghost/route.ts':
          "import { requireUpstreamBase } from '@/lib/api/upstream-proxy';\n" + good,
      },
    },
    {
      name: '501 stub via notImplementedResponse',
      config: { crons: [{ path: '/api/cron/ghost', schedule: '0 19 * * *' }] },
      sources: {
        'src/app/api/cron/ghost/route.ts':
          "import { notImplementedResponse } from '@/lib/integrations/not-implemented-response';\n" +
          good,
      },
    },
    {
      // The reviewer's demonstrated bypass: the route itself is clean, and a
      // thin local wrapper one hop away is what returns 501. Keep this forever.
      name: '501 stub one import hop away, via a local wrapper',
      config: { crons: [{ path: '/api/cron/ghost', schedule: '0 19 * * *' }] },
      sources: {
        'src/app/api/cron/ghost/route.ts':
          "import { runGhostJob } from '@/lib/jobs/ghost-runner';\n" +
          'export async function GET() { return runGhostJob(); }',
        'src/lib/jobs/ghost-runner.ts':
          "import { upstreamUnavailable } from '@/lib/api/upstream-proxy';\n" +
          'export function runGhostJob() { return upstreamUnavailable("Ghost job"); }',
      },
    },
    {
      name: '501 returned by a transitively imported helper',
      config: { crons: [{ path: '/api/cron/ghost', schedule: '0 19 * * *' }] },
      sources: {
        'src/app/api/cron/ghost/route.ts':
          "import { a } from './a';\nexport async function GET() { return a(); }",
        'src/app/api/cron/ghost/a.ts': "import { b } from './b';\nexport const a = () => b();",
        'src/app/api/cron/ghost/b.ts':
          'export const b = () => Response.json({ ok: false }, { status: 501 });',
      },
    },
    {
      // Reviewer bypass: a depth cap of six let a 501 seven hops away escape.
      name: '501 seven import hops away',
      config: { crons: [{ path: '/api/cron/ghost', schedule: '0 19 * * *' }] },
      sources: {
        'src/app/api/cron/ghost/route.ts':
          "import { h1 } from './h1';\nexport async function GET() { return h1(); }",
        'src/app/api/cron/ghost/h1.ts': "import { h2 } from './h2';\nexport const h1 = () => h2();",
        'src/app/api/cron/ghost/h2.ts': "import { h3 } from './h3';\nexport const h2 = () => h3();",
        'src/app/api/cron/ghost/h3.ts': "import { h4 } from './h4';\nexport const h3 = () => h4();",
        'src/app/api/cron/ghost/h4.ts': "import { h5 } from './h5';\nexport const h4 = () => h5();",
        'src/app/api/cron/ghost/h5.ts': "import { h6 } from './h6';\nexport const h5 = () => h6();",
        'src/app/api/cron/ghost/h6.ts': "import { h7 } from './h7';\nexport const h6 = () => h7();",
        'src/app/api/cron/ghost/h7.ts':
          'export const h7 = () => Response.json({}, { status: 501 });',
      },
    },
    {
      // Reviewer bypass: dynamic import() was not treated as an edge.
      name: '501 reached through a dynamic import',
      config: { crons: [{ path: '/api/cron/ghost', schedule: '0 19 * * *' }] },
      sources: {
        'src/app/api/cron/ghost/route.ts':
          "export async function GET() { const m = await import('./stub'); return m.run(); }",
        'src/app/api/cron/ghost/stub.ts':
          "import { upstreamUnavailable } from '@/lib/api/upstream-proxy';\n" +
          'export const run = () => upstreamUnavailable("ghost");',
      },
    },
    {
      // Reviewer bypass: literal-substring matching missed unusual spacing.
      name: '501 written with unusual spacing',
      config: { crons: [{ path: '/api/cron/ghost', schedule: '0 19 * * *' }] },
      sources: {
        'src/app/api/cron/ghost/route.ts':
          'export async function GET() { return Response.json({}, { status : 501 }); }',
      },
    },
    {
      // The fail-open auth pattern that shipped in twelve handlers.
      name: 'handler inlines the fail-open CRON_SECRET comparison',
      config: { crons: [{ path: '/api/cron/ghost', schedule: '0 19 * * *' }] },
      sources: {
        'src/app/api/cron/ghost/route.ts':
          'export async function GET(request) {\n' +
          "  const authHeader = request.headers.get('authorization');\n" +
          '  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return new Response("no", { status: 401 });\n' +
          '  return Response.json({ ok: true });\n' +
          '}',
      },
    },
    {
      name: 'scheduled path with no route file',
      config: { crons: [{ path: '/api/cron/missing', schedule: '0 9 * * *' }] },
      sources: {},
    },
    {
      name: 'route exports neither GET nor POST',
      config: { crons: [{ path: '/api/cron/inert', schedule: '0 9 * * *' }] },
      sources: { 'src/app/api/cron/inert/route.ts': 'export const revalidate = 0;' },
    },
    {
      name: 'missing schedule',
      config: { crons: [{ path: '/api/cron/ok' }] },
      sources: { 'src/app/api/cron/ok/route.ts': good },
    },
    {
      name: 'duplicate schedule for one path',
      config: {
        crons: [
          { path: '/api/cron/ok', schedule: '0 9 * * *' },
          { path: '/api/cron/ok', schedule: '0 10 * * *' },
        ],
      },
      sources: { 'src/app/api/cron/ok/route.ts': good },
    },
  ];

  for (const testCase of cases) {
    const failures = validateCrons(testCase.config, (p) =>
      Object.prototype.hasOwnProperty.call(testCase.sources, p) ? testCase.sources[p] : null
    );
    if (failures.length === 0) {
      throw new Error(`self-test did not reject: ${testCase.name}`);
    }
  }

  // Negative control: a sound config must pass, or the check rejects everything
  // and its failures carry no information either.
  const soundFailures = validateCrons(
    { crons: [{ path: '/api/cron/ok', schedule: '0 9 * * *' }] },
    (p) => (p === 'src/app/api/cron/ok/route.ts' ? good : null)
  );
  if (soundFailures.length > 0) {
    throw new Error(`self-test rejected a sound config:\n- ${soundFailures.join('\n- ')}`);
  }

  // Negative control 2: the reviewer showed a harmless module being REJECTED
  // because a STRING contained "status: 501". A gate that cries wolf is ignored,
  // which fails the same way as one that stays silent.
  const falsePositiveFailures = validateCrons(
    { crons: [{ path: '/api/cron/ok', schedule: '0 9 * * *' }] },
    (p) => {
      if (p === 'src/app/api/cron/ok/route.ts') {
        return "import { note } from './note';\n" + good;
      }
      if (p === 'src/app/api/cron/ok/note.ts') {
        return "export const note = 'legacy status: 501 was returned here until 2026-08';";
      }
      return null;
    }
  );
  if (falsePositiveFailures.length > 0) {
    throw new Error(
      `self-test rejected a sound config over a string literal:\n- ${falsePositiveFailures.join('\n- ')}`
    );
  }

  // Negative control 3: a specifier escaping the repo must simply not resolve,
  // never be read from disk above the root.
  const traversalFailures = validateCrons(
    { crons: [{ path: '/api/cron/ok', schedule: '0 9 * * *' }] },
    (p) => {
      if (p === 'src/app/api/cron/ok/route.ts') {
        return "import { x } from '../../../../../../outside/secrets';\n" + good;
      }
      if (p.includes('outside')) throw new Error(`read escaped the repo root: ${p}`);
      return null;
    }
  );
  if (traversalFailures.length > 0) {
    throw new Error(`self-test rejected a sound config on traversal:\n- ${traversalFailures.join('\n- ')}`);
  }

  return { rejectedCases: cases.length, acceptedCases: 3 };
}

function main() {
  if (process.argv[2] === '--self-test') {
    const result = selfTest();
    console.log(
      `Vercel cron validator self-test passed: rejected=${result.rejectedCases} accepted=${result.acceptedCases}`
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
