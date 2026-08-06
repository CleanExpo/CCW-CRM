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
// pass. Detecting those needs execution, not parsing.
//
// Rule 4 is structural but NOT a control-flow proof: it requires the canonical
// import, a real call, and the result reaching a return. A guard made
// unreachable by `if (false)` or an earlier return still satisfies it. An
// earlier header called rules 1-4 "decisive" while rule 4 was a substring match;
// that claim was wrong and is not repeated.
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
 * Every module shape a bare specifier can resolve to. `.mjs`, `.js`, `.jsx` and
 * the JavaScript directory indexes were missing, so a 501 living in any of those
 * was simply never read.
 */
const MODULE_CANDIDATES = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
  '/index.mjs',
];

/**
 * Local module specifiers, via the TypeScript parser.
 * Regexes could not tell an import from a string that reads like one; the
 * compiler can. Catches static, dynamic import() and re-exports.
 */
function localImports(source, importerPath, disabled = new Set()) {
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
    resolved.push(
      base,
      ...MODULE_CANDIDATES.filter((ext) => !disabled.has(`candidate:${ext}`)).map(
        (ext) => `${base}${ext}`
      )
    );
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

const CRON_AUTH_MODULE = '@/lib/api/cron-auth';

/**
 * Rule 4, structurally.
 *
 * The first version tested only that the text `cronAuthFailure(` appeared
 * somewhere. A reviewer walked past it six ways: ignoring the return value,
 * wrapping the call in `if (false)`, placing it after the response, shadowing
 * the name with a local no-op, importing it from a different module, and
 * burying it in a closure that is never called.
 *
 * This now requires, via the AST:
 *   - the identifier is imported from @/lib/api/cron-auth (kills the shadow and
 *     the wrong-module import)
 *   - it is actually called (kills a bare reference)
 *   - its result reaches a `return` — either `return cronAuthFailure(...)` or
 *     assigned to a name that a `return` uses (kills the ignored return value)
 *
 * WHAT IT STILL DOES NOT PROVE: that the return executes. Code made unreachable
 * by a surrounding `if (false)` or an earlier `return` will satisfy this. That
 * needs control-flow analysis, and saying so is the point — the previous header
 * called this rule "decisive" when it was satisfied by a substring.
 *
 * @returns {string | null} a problem description, or null when satisfied
 */
function checkGuardUsage(source) {
  let sourceFile;
  try {
    sourceFile = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
  } catch {
    return 'could not be parsed, so its authorisation cannot be verified.';
  }

  let canonicalLocalName = null;   // the binding the canonical import introduces
  let shadowedByLocalDecl = false; // a local declaration of that same name
  const calledAndBoundTo = new Set();
  let callResultReturnedDirectly = false;
  const returnedIdentifiers = new Set();
  let calledAtAll = false;

  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === CRON_AUTH_MODULE &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      for (const el of node.importClause.namedBindings.elements) {
        if ((el.propertyName?.text ?? el.name.text) === 'cronAuthFailure') {
          canonicalLocalName = el.name.text;
        }
      }
    }

    // The call must target the binding the CANONICAL import introduced. An
    // alias plus a local no-op named cronAuthFailure satisfied the old check.
    const isGuardCall = (n) =>
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      canonicalLocalName !== null &&
      n.expression.text === canonicalLocalName;

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === canonicalLocalName &&
      node.initializer &&
      !isGuardCall(node.initializer)
    ) {
      shadowedByLocalDecl = true;
    }

    if (isGuardCall(node)) calledAtAll = true;

    // const x = cronAuthFailure(request)
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      if (isGuardCall(node.initializer)) calledAndBoundTo.add(node.name.text);
    }

    const noteReturned = (expr) => {
      if (!expr) return;
      if (isGuardCall(expr)) callResultReturnedDirectly = true;
      // ONLY `??`. The guard returns null when authorised, so
      // `return cronAuthFailure(req) && Response.json(...)` yields the PUBLIC
      // response on the refused path too — a bypass a reviewer demonstrated.
      // `||` has the same defect.
      if (
        ts.isBinaryExpression(expr) &&
        isGuardCall(expr.left) &&
        expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        callResultReturnedDirectly = true;
      }
      if (ts.isIdentifier(expr)) returnedIdentifiers.add(expr.text);
    };

    if (ts.isReturnStatement(node)) noteReturned(node.expression);

    // An arrow with a concise body returns it — `const GET = async (r) =>
    // cronAuthFailure(r) ?? json()` is valid and was being rejected.
    if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) noteReturned(node.body);

    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (canonicalLocalName === null) {
    return `does not import cronAuthFailure from '${CRON_AUTH_MODULE}'.`;
  }
  if (shadowedByLocalDecl) {
    return `declares a local '${canonicalLocalName}' shadowing the imported guard.`;
  }
  if (!calledAtAll) return 'never calls cronAuthFailure().';

  const resultIsReturned =
    callResultReturnedDirectly || [...calledAndBoundTo].some((name) => returnedIdentifiers.has(name));
  if (!resultIsReturned) {
    return 'calls cronAuthFailure() but never returns its result, so the check cannot refuse anything.';
  }
  return null;
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
function findStubInClosure(entryPath, read, disabled = new Set()) {
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

    queue.push(...localImports(source, filePath, disabled));
  }
  return null;
}

/**
 * @param {{crons?: Array<{path?: string, schedule?: string}>}} config
 * @param {(relPath: string) => string | null} readSource
 * @returns {string[]} failures
 */
function validateCrons(config, readSource, disabled = new Set()) {
  const failures = [];
  const on = (rule) => !disabled.has(rule);
  const crons = Array.isArray(config.crons) ? config.crons : [];
  if (crons.length === 0) return failures;

  const seen = new Set();

  for (const cron of crons) {
    const cronPath = cron && cron.path;

    if (on('path-shape') && (typeof cronPath !== 'string' || !cronPath.startsWith('/api/'))) {
      failures.push(`cron entry has no usable path: ${JSON.stringify(cron)}`);
      continue;
    }
    // A path containing `..` produced a read request above the repository root.
    if (on('path-traversal') && cronPath.split('/').includes('..')) {
      failures.push(`${cronPath}: path traversal segment is not a valid route`);
      continue;
    }
    if (on('schedule') && (typeof cron.schedule !== 'string' || cron.schedule.trim() === '')) {
      failures.push(`${cronPath}: missing schedule`);
    }
    if (on('duplicate') && seen.has(cronPath)) failures.push(`${cronPath}: scheduled more than once`);
    seen.add(cronPath);

    const relPath = path.posix.join('src/app', cronPath, 'route.ts');
    const source = readSource(relPath);

    if (source === null) {
      if (on('route-missing')) {
        failures.push(`${cronPath}: scheduled, but no Route Handler at ${relPath}`);
      }
      continue;
    }
    if (on('handler-export') && !exportsHandler(source)) {
      failures.push(`${cronPath}: ${relPath} exports neither GET nor POST`);
    }
    const code = stripComments(source);
    if (on('inline-fail-open') && INLINE_FAIL_OPEN.test(code)) {
      failures.push(
        `${cronPath}: ${relPath} inlines the CRON_SECRET comparison. When CRON_SECRET is ` +
          `unset that template is the literal string "Bearer undefined", so sending exactly ` +
          `that header authorises the endpoint. Use cronAuthFailure() from ` +
          `@/lib/api/cron-auth, which fails closed.`
      );
    }
    const authProblem = on('guard-usage') ? checkGuardUsage(source) : null;
    if (authProblem) {
      failures.push(
        `${cronPath}: ${relPath} ${authProblem} Every scheduled endpoint must authorise ` +
          `through cronAuthFailure() from '${CRON_AUTH_MODULE}', which fails closed when ` +
          `CRON_SECRET is unset, and must RETURN its result.`
      );
    }

    const stub = on('stub-graph') ? findStubInClosure(relPath, readSource, disabled) : null;
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
    "import { cronAuthFailure } from '@/lib/api/cron-auth';\n" +
    'export async function GET(request: Request) {\n' +
    '  const unauthorized = cronAuthFailure(request);\n' +
    '  if (unauthorized) return unauthorized;\n' +
    '  return Response.json({ ok: true });\n' +
    '}';
  const P = '/api/cron/ghost';
  const R = 'src/app/api/cron/ghost/route.ts';
  const oneCron = { crons: [{ path: P, schedule: '0 19 * * *' }] };

  // Every fixture below carries the auth guard unless it is specifically
  // testing rule 4, and every case asserts the SPECIFIC failure it exists to
  // provoke. An earlier revision asserted only `failures.length > 0`, so once
  // rule 4 started rejecting fixtures for a missing guard, deleting the entire
  // import-graph traversal left --self-test green. A reviewer demonstrated it.
  // "Some failure occurred" is not a control; "this failure occurred" is.
  const AUTH = "import { cronAuthFailure } from '@/lib/api/cron-auth';\n";
  const guarded = (body) =>
    AUTH +
    'export async function GET(request: Request) {\n' +
    '  const unauthorized = cronAuthFailure(request);\n' +
    '  if (unauthorized) return unauthorized;\n' +
    `  ${body}\n` +
    '}';

  const mustReject = [
    {
      name: '501 via upstream-proxy import',
      expect: 'requireUpstreamBase',
      files: { [R]: AUTH + "import { requireUpstreamBase } from '@/lib/api/upstream-proxy';\n" + guarded('return Response.json({});') },
    },
    {
      name: '501 via notImplementedResponse',
      expect: 'notImplementedResponse',
      files: { [R]: AUTH + "import { notImplementedResponse } from '@/lib/integrations/not-implemented-response';\n" + guarded('return Response.json({});') },
    },
    {
      name: 'literal status: 501',
      expect: 'status: 501',
      files: { [R]: guarded('return Response.json({}, { status: 501 });') },
    },
    {
      name: 'status : 501 with unusual spacing',
      expect: 'status: 501',
      files: { [R]: guarded('return Response.json({}, { status : 501 });') },
    },
    {
      name: '501 one hop away via a local wrapper',
      expect: 'via src/lib/jobs/ghost.ts',
      files: {
        [R]: AUTH + "import { run } from '@/lib/jobs/ghost';\n" + guarded('return run();'),
        'src/lib/jobs/ghost.ts': "import { upstreamUnavailable } from '@/lib/api/upstream-proxy';\nexport const run = () => upstreamUnavailable('g');",
      },
    },
    {
      name: '501 seven hops away',
      expect: 'via src/app/api/cron/ghost/h7.ts',
      files: (() => {
        const f = { [R]: AUTH + "import { h1 } from './h1';\n" + guarded('return h1();') };
        for (let i = 1; i < 7; i += 1) {
          f[`src/app/api/cron/ghost/h${i}.ts`] = `import { h${i + 1} } from './h${i + 1}';\nexport const h${i} = () => h${i + 1}();`;
        }
        f['src/app/api/cron/ghost/h7.ts'] = 'export const h7 = () => Response.json({}, { status: 501 });';
        return f;
      })(),
    },
    {
      name: '501 through a dynamic import',
      expect: 'via src/app/api/cron/ghost/stub.ts',
      files: {
        [R]: guarded("const m = await import('./stub'); return m.run();"),
        'src/app/api/cron/ghost/stub.ts': "import { upstreamUnavailable } from '@/lib/api/upstream-proxy';\nexport const run = () => upstreamUnavailable('g');",
      },
    },
    {
      name: '501 through a barrel re-export',
      expect: 'via src/app/api/cron/ghost/impl.ts',
      files: {
        [R]: AUTH + "import { run } from './barrel';\n" + guarded('return run();'),
        'src/app/api/cron/ghost/barrel.ts': "export { run } from './impl';",
        'src/app/api/cron/ghost/impl.ts': 'export const run = () => Response.json({}, { status: 501 });',
      },
    },
    // One fixture per module shape in MODULE_CANDIDATES, generated so the list
    // and its controls cannot drift apart. The meta-control below proves each
    // shape is individually load-bearing.
    ...MODULE_CANDIDATES.map((ext) => {
      const target = `src/app/api/cron/ghost/shape${ext.startsWith('/') ? ext : `${ext}`}`;
      const modulePath = ext.startsWith('/')
        ? `src/app/api/cron/ghost/shape${ext}`
        : `src/app/api/cron/ghost/shape${ext}`;
      return {
        name: `501 in a module resolved as "${ext}"`,
        expect: `via ${modulePath}`,
        files: {
          [R]: AUTH + "import { run } from './shape';\n" + guarded('return run();'),
          [modulePath]: 'export const run = () => Response.json({}, { status: 501 });',
        },
      };
    }),
    {
      name: 'inline fail-open CRON_SECRET comparison',
      expect: 'inlines the CRON_SECRET comparison',
      files: { [R]: AUTH + 'export async function GET(request) {\n  const unauthorized = cronAuthFailure(request);\n  if (unauthorized) return unauthorized;\n  const a = request.headers.get("authorization");\n  if (a !== `Bearer ${process.env.CRON_SECRET}`) return new Response("no", { status: 401 });\n  return Response.json({ ok: true });\n}' },
    },
    {
      name: 'no GET or POST export',
      expect: 'exports neither GET nor POST',
      files: { [R]: AUTH + 'const unauthorized = cronAuthFailure(new Request("http://x"));\nexport const revalidate = 0;' },
    },
    {
      name: 'no route file at all',
      expect: 'no Route Handler at',
      files: {},
    },
    {
      name: 'handler with no authorisation at all',
      expect: 'does not import cronAuthFailure',
      files: { [R]: 'export async function GET() { return Response.json({ ok: true }); }' },
    },
    {
      name: 'handler authorising via some other helper',
      expect: 'does not import cronAuthFailure',
      files: { [R]: "import { allowEveryone } from '@/lib/api/allow';\nexport async function GET(request) { allowEveryone(request); return Response.json({}); }" },
    },
    {
      name: 'export const GET = 42 (not callable)',
      expect: 'does not import cronAuthFailure',
      files: { [R]: 'export const GET = 42;' },
    },
    {
      // Reviewer bypass: calls the guard and throws the answer away.
      name: 'guard called but its return value ignored',
      expect: 'never returns its result',
      files: { [R]: AUTH + 'export async function GET(request) {\n  cronAuthFailure(request);\n  return Response.json({ ok: true });\n}' },
    },
    {
      // Reviewer bypass: a local no-op shadowing the real guard.
      name: 'guard name shadowed by a local no-op',
      expect: 'does not import cronAuthFailure',
      files: { [R]: 'const cronAuthFailure = () => null;\nexport async function GET(request) {\n  const u = cronAuthFailure(request);\n  if (u) return u;\n  return Response.json({});\n}' },
    },
    {
      // Reviewer bypass: right name, wrong module.
      name: 'guard imported from the wrong module',
      expect: 'does not import cronAuthFailure',
      files: { [R]: "import { cronAuthFailure } from '@/lib/api/not-the-real-guard';\nexport async function GET(request) {\n  const u = cronAuthFailure(request);\n  if (u) return u;\n  return Response.json({});\n}" },
    },
    {
      // Reviewer bypass: canonical import ALIASED, with a local no-op taking the
      // original name — the call then targets the no-op.
      name: 'canonical import aliased with a local no-op of the original name',
      // Caught by the call-target rule: the alias is what was imported, and the
      // alias is never called — the local no-op is.
      expect: 'never calls cronAuthFailure',
      files: { [R]: "import { cronAuthFailure as realGuard } from '@/lib/api/cron-auth';\nconst cronAuthFailure = () => null;\nexport async function GET(request) {\n  const u = cronAuthFailure(request);\n  if (u) return u;\n  return Response.json({});\n}" },
    },
    {
      // Reviewer bypass: `&&` returns the PUBLIC response on the refused path.
      // Only `??` short-circuits correctly, because the guard returns null when
      // the request IS authorised.
      name: 'guard result combined with && instead of ??',
      expect: 'never returns its result',
      files: { [R]: AUTH + 'export const GET = async (request) => cronAuthFailure(request) && Response.json({ public: true });' },
    },
    {
      // Same defect with ||.
      name: 'guard result combined with || instead of ??',
      expect: 'never returns its result',
      files: { [R]: AUTH + 'export const GET = async (request) => cronAuthFailure(request) || Response.json({ public: true });' },
    },
    {
      // Reviewer bypass: referenced but never invoked.
      name: 'guard referenced but never called',
      expect: 'never calls cronAuthFailure',
      files: { [R]: AUTH + 'const guard = cronAuthFailure;\nexport async function GET() { return Response.json({}); }' },
    },
  ];

  for (const c of mustReject) {
    const failures = validateCrons(oneCron, (p) =>
      Object.prototype.hasOwnProperty.call(c.files, p) ? c.files[p] : null
    );
    if (!failures.some((f) => f.includes(c.expect))) {
      throw new Error(
        `self-test did not reject: ${c.name} (expected a failure containing "${c.expect}", got ${
          failures.length ? failures.join(' | ') : 'none'
        })`
      );
    }
  }

  // Config-shape rejections. These asserted only `failures.length > 0` and so
  // were satisfied by the unrelated "no Route Handler" failure — disabling the
  // path-traversal rule left --self-test green. They assert specifics now.
  const configCases = [
    { name: 'missing schedule', expect: 'missing schedule', cfg: { crons: [{ path: P }] } },
    {
      name: 'duplicate schedule',
      expect: 'scheduled more than once',
      cfg: { crons: [{ path: P, schedule: '0 9 * * *' }, { path: P, schedule: '0 10 * * *' }] },
    },
    {
      name: 'path traversal segment',
      expect: 'path traversal segment',
      cfg: { crons: [{ path: '/api/../../../../outside', schedule: '0 9 * * *' }] },
    },
    {
      name: 'path not under /api/',
      expect: 'no usable path',
      cfg: { crons: [{ path: '/not-api/thing', schedule: '0 9 * * *' }] },
    },
  ];
  for (const c of configCases) {
    const failures = validateCrons(c.cfg, (p) => (p === R ? good : null));
    if (!failures.some((f) => f.includes(c.expect))) {
      throw new Error(
        `self-test did not reject: ${c.name} (expected "${c.expect}", got ${
          failures.length ? failures.join(' | ') : 'none'
        })`
      );
    }
  }

  // Negative controls — each MUST pass, or a failure from this gate means nothing.
  const guard =
    "import { cronAuthFailure } from '@/lib/api/cron-auth';\n" +
    '  const unauthorized = cronAuthFailure(request);\n  if (unauthorized) return unauthorized;\n';

  const mustAccept = [
    { name: 'export async function GET', files: { [R]: good } },
    { name: 'export const GET = async', files: { [R]: "import { cronAuthFailure } from '@/lib/api/cron-auth';\nexport const GET = async (request: Request) => cronAuthFailure(request) ?? Response.json({ ok: true });" } },
    { name: 'export { GET }', files: { [R]: "import { cronAuthFailure } from '@/lib/api/cron-auth';\nconst GET = async (request) => cronAuthFailure(request) ?? Response.json({});\nexport { GET };" } },
    { name: 'export async function POST', files: { [R]: 'export async function POST(request) {\n' + guard + '  return Response.json({});\n}' } },
    {
      name: 'a string literal mentioning status: 501 must NOT flag',
      files: {
        [R]: "import { note } from './note';\n" + good,
        'src/app/api/cron/ghost/note.ts': "export const note = 'legacy status: 501 was returned here until 2026-08';",
      },
    },
    {
      // MUTATION CANARY — this case is why the parser matters, and it is
      // constructed so that a naive regex gives a DIFFERENT verdict.
      //
      // The handler does not import ./legacy-stub. It only MENTIONS it inside a
      // string. The TypeScript parser sees no import and this passes. Swap the
      // parser for a regex and it follows the string, reaches the 501, and
      // wrongly rejects — so --self-test goes red.
      //
      // The previous canary failed to discriminate: it left a REAL import in
      // place, so the mutant found the same 501 and the verdict never changed.
      // A control that produces the same answer under the mutant is not a
      // control. A reviewer mutated the parser out of this file and watched
      // --self-test stay green.
      name: 'a 501 module named only inside a string must NOT be followed',
      files: {
        [R]:
          good + "\nconst hint = \"import './legacy-stub' if you need the old behaviour\";\n",
        'src/app/api/cron/ghost/legacy-stub.ts':
          'export const run = () => Response.json({}, { status: 501 });',
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

  // META-CONTROL — every rule must be covered by at least one DISCRIMINATING
  // fixture.
  //
  // Four review rounds in a row found a rule that could be deleted with
  // --self-test staying green, each time because some fixture asserted "a
  // failure happened" rather than "this failure happened", or because no fixture
  // exercised that rule at all. Patching them one at a time kept missing the
  // next one. This proves the property directly: disable each rule in turn and
  // require that some case stops producing its expected failure. If a rule can
  // be switched off with every assertion still satisfied, that rule is unguarded
  // and this throws.
  const allCases = [
    ...mustReject.map((c) => ({ name: c.name, expect: c.expect, cfg: oneCron, files: c.files })),
    ...configCases.map((c) => ({ name: c.name, expect: c.expect, cfg: c.cfg, files: { [R]: good } })),
  ];

  const RULES = [
    'path-shape',
    'path-traversal',
    'schedule',
    'duplicate',
    'route-missing',
    'handler-export',
    'inline-fail-open',
    'guard-usage',
    'stub-graph',
    ...MODULE_CANDIDATES.map((ext) => `candidate:${ext}`),
  ];

  for (const rule of RULES) {
    const disabled = new Set([rule]);
    const stillCaught = allCases.every((c) => {
      const failures = validateCrons(
        c.cfg,
        (p) => (Object.prototype.hasOwnProperty.call(c.files, p) ? c.files[p] : null),
        disabled
      );
      return failures.some((f) => f.includes(c.expect));
    });
    if (stillCaught) {
      throw new Error(
        `META-CONTROL FAILED: rule "${rule}" can be disabled with every self-test ` +
          `assertion still satisfied. It is unguarded — add a fixture that fails ` +
          `specifically because of it.`
      );
    }
  }

  return {
    rejectedCases: mustReject.length + configCases.length,
    acceptedCases: mustAccept.length,
    rulesProven: RULES.length,
  };
}

function main() {
  if (process.argv[2] === '--self-test') {
    const r = selfTest();
    console.log(
      `Vercel cron validator self-test passed: rejected=${r.rejectedCases} ` +
        `accepted=${r.acceptedCases} rules-proven-guarded=${r.rulesProven}`
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
