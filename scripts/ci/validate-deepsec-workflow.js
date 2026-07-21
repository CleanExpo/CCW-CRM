#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ID = 'CCW-CRM';
const WORKFLOW_PATH = path.resolve(
  process.cwd(),
  '.github/workflows/deepsec-weekly.yml',
);

function requireMatch(content, pattern, message, failures) {
  if (!pattern.test(content)) failures.push(message);
}

function requireExactStep(content, name, expected, failures) {
  const marker = `      - name: ${name}\n`;
  const parts = content.split(marker);
  if (parts.length !== 2) {
    failures.push(`${name} step must appear exactly once`);
    return;
  }
  const body = parts[1].split('\n      - name:')[0];
  if (`${marker}${body}` !== expected) failures.push(`${name} step must match the fail-closed contract`);
}

function validateWorkflow(content) {
  const active = content
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  const failures = [];
  requireExactStep(
    active,
    'Setup Node.js',
    "      - name: Setup Node.js\n        uses: actions/setup-node@v4\n        with:\n          node-version: '22'",
    failures,
  );
  requireExactStep(
    active,
    'Install dependencies',
    '      - name: Install dependencies\n        run: |\n          cd .deepsec\n          npm install',
    failures,
  );
  requireExactStep(
    active,
    'Run Deepsec',
    '      - name: Run Deepsec\n        run: |\n          cd .deepsec\n          result_root="$PWD/data/CCW-CRM"\n          result_dir="$result_root/runs"\n          rm -rf "$result_root"\n          trap \'rm -rf "$result_root"\' EXIT\n          scan_started_at=$(date +%s)\n          npx deepsec scan --project-id CCW-CRM\n          node ../scripts/ci/validate-deepsec-workflow.js --receipt "$result_dir" --started-at "$scan_started_at"',
    failures,
  );
  requireMatch(active, /^  schedule:\s*$\n[\s\S]*?^    - cron:/m, 'weekly schedule is required', failures);
  requireMatch(active, /^  workflow_dispatch:\s*$/m, 'manual trigger is required', failures);
  requireMatch(active, /^  contents: read$/m, 'contents permission must be read-only', failures);
  requireMatch(active, /^  issues: write$/m, 'issue permission is required', failures);
  requireMatch(active, /^    runs-on: ubuntu-latest$/m, 'Deepsec must run on Ubuntu', failures);
  requireMatch(active, /^      - uses: actions\/checkout@v4$/m, 'checkout step is required', failures);
  requireMatch(active, /^        uses: actions\/setup-node@v4$/m, 'setup-node step is required', failures);
  requireMatch(active, /^          node-version: ['"]22['"]$/m, 'Deepsec must run on Node 22', failures);
  requireMatch(active, /^          cd \.deepsec\s*$\n^          npm install$/m, 'Deepsec workspace install is required', failures);
  requireMatch(
    active,
    /^          npx deepsec scan --project-id CCW-CRM$/m,
    'exact CCW-CRM scan command is required',
    failures,
  );
  requireMatch(
    active,
    /result_dir="\$result_root\/runs"\s*\n\s*rm -rf "\$result_root"/,
    'stale scan data must be removed before scanning',
    failures,
  );
  requireMatch(active, /^          trap 'rm -rf "\$result_root"' EXIT$/m, 'generated scan data must be cleaned', failures);
  requireMatch(active, /^          scan_started_at=\$\(date \+%s\)$/m, 'scan start time must be captured', failures);
  requireMatch(
    active,
    /^          node \.\.\/scripts\/ci\/validate-deepsec-workflow\.js --receipt "\$result_dir" --started-at "\$scan_started_at"$/m,
    'completed scan receipt must be validated',
    failures,
  );
  requireMatch(active, /^        if: failure\(\)$/m, 'scan failures must keep the job failed', failures);
  requireMatch(active, /actions\/runs\/\$\{\{ github\.run_id \}\}/, 'failure issue must link the exact run', failures);

  if (/^  pull-requests: write$/m.test(active)) {
    failures.push('unused pull-request write permission must not be present');
  }
  if (/Weekly scan findings|found new issues|Deepsec findings/i.test(active)) {
    failures.push('generic workflow failures must not be described as findings');
  }

  const scanStep = active.match(/- name: Run Deepsec([\s\S]*?)(?=\n\s*- name:|$)/)?.[1] || '';
  if (!scanStep) failures.push('Run Deepsec step is required');
  if (/continue-on-error:\s*true|\|\|\s*true|set \+e/.test(scanStep)) {
    failures.push('Deepsec scan or receipt failure must not be masked');
  }

  return failures;
}

function parseDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error(`${field} must be an ISO-8601 UTC timestamp`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${field} must be a valid timestamp`);
  if (new Date(timestamp).toISOString() !== value) throw new Error(`${field} must be a real calendar timestamp`);
  return timestamp;
}

function validateReceipt(resultDir, startedAtSeconds) {
  if (!fs.existsSync(resultDir)) {
    throw new Error(`receipt directory is missing: ${resultDir}`);
  }
  const resultDirStat = fs.lstatSync(resultDir);
  if (resultDirStat.isSymbolicLink() || !resultDirStat.isDirectory()) {
    throw new Error('receipt directory must be a real directory');
  }
  if (fs.realpathSync(resultDir) !== path.resolve(resultDir)) {
    throw new Error('receipt directory path must not contain symlinks');
  }

  const files = fs.readdirSync(resultDir).filter((file) => file.endsWith('.json'));
  if (files.length !== 1) {
    throw new Error(`expected exactly one receipt JSON, found ${files.length}`);
  }

  const receiptPath = path.join(resultDir, files[0]);
  const stat = fs.lstatSync(receiptPath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('receipt must be a regular file');
  if (startedAtSeconds !== undefined && stat.mtimeMs < (startedAtSeconds - 1) * 1000) {
    throw new Error('receipt file predates this scan');
  }

  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    throw new Error(`receipt is not valid JSON: ${error.message}`);
  }

  if (receipt.projectId !== PROJECT_ID) throw new Error(`projectId must be ${PROJECT_ID}`);
  if (receipt.type !== 'scan') throw new Error('type must be scan');
  if (receipt.phase !== 'done') throw new Error('phase must be done');
  if (typeof receipt.runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(receipt.runId)) {
    throw new Error('runId must be a safe non-empty identifier');
  }

  const createdAt = parseDate(receipt.createdAt, 'createdAt');
  const completedAt = parseDate(receipt.completedAt, 'completedAt');
  if (completedAt < createdAt) throw new Error('completedAt must not precede createdAt');
  if (startedAtSeconds !== undefined && createdAt < (startedAtSeconds - 1) * 1000) {
    throw new Error('receipt content predates this scan');
  }

  if (!Number.isInteger(receipt.stats?.filesScanned) || receipt.stats.filesScanned <= 0) {
    throw new Error('stats.filesScanned must be a positive integer');
  }
  if (!Number.isInteger(receipt.stats?.candidatesFound) || receipt.stats.candidatesFound < 0) {
    throw new Error('stats.candidatesFound must be a non-negative integer');
  }

  return {
    receiptPath,
    runId: receipt.runId,
    filesScanned: receipt.stats.filesScanned,
    candidatesFound: receipt.stats.candidatesFound,
  };
}

function writeReceipt(dir, overrides = {}) {
  const now = new Date();
  const receipt = {
    projectId: PROJECT_ID,
    type: 'scan',
    phase: 'done',
    runId: 'self-test-run',
    createdAt: now.toISOString(),
    completedAt: new Date(now.getTime() + 1000).toISOString(),
    stats: { filesScanned: 1, candidatesFound: 0 },
    ...overrides,
  };
  fs.writeFileSync(path.join(dir, 'receipt.json'), JSON.stringify(receipt));
}

function expectFailure(name, expectedMessage, operation) {
  try {
    operation();
  } catch (error) {
    if (error.message.includes(expectedMessage)) return;
    throw new Error(`self-test ${name} failed for the wrong reason: ${error.message}`);
  }
  throw new Error(`self-test did not reject: ${name}`);
}

function runSelfTests(workflow) {
  const workflowFailures = validateWorkflow(workflow);
  if (workflowFailures.length > 0) {
    throw new Error(`repository workflow is not a valid positive fixture:\n- ${workflowFailures.join('\n- ')}`);
  }

  const mutations = [
    ['Node 20', "node-version: '22'", "node-version: '20'"],
    ['manual trigger removed', '  workflow_dispatch:', '  disabled_dispatch:'],
    ['contents write permission', '  contents: read', '  contents: write'],
    ['write permission restored', '  issues: write', '  issues: write\n  pull-requests: write'],
    ['issue permission removed', '  issues: write', '  issues: read'],
    ['Ubuntu runner removed', '    runs-on: ubuntu-latest', '    runs-on: windows-latest'],
    ['checkout hidden in comment', '      - uses: actions/checkout@v4', '      - uses: actions/checkout@v3\n      # uses: actions/checkout@v4'],
    ['setup-node hidden in comment', '        uses: actions/setup-node@v4', '        uses: actions/setup-node@v3\n        # uses: actions/setup-node@v4'],
    ['Node 22 hidden in comment', "          node-version: '22'", "          node-version: '20'\n          # node-version: '22'"],
    ['install removed', '          npm install', '          echo install-disabled'],
    ['command drift', '--project-id CCW-CRM', '--project-id other'],
    ['scan replaced by echo', '          npx deepsec scan --project-id CCW-CRM', '          echo "npx deepsec scan --project-id CCW-CRM"'],
    ['scan hidden in multiline echo', '          npx deepsec scan --project-id CCW-CRM', "          echo 'disabled\n          npx deepsec scan --project-id CCW-CRM\n          command'"],
    ['scan masked', '          npx deepsec scan', '          npx deepsec scan --disabled || true #'],
    ['stale cleanup removed', '          rm -rf "$result_root"', '          echo no-stale-cleanup'],
    ['EXIT cleanup removed', "          trap 'rm -rf \"$result_root\"' EXIT", '          echo no-exit-cleanup'],
    ['receipt check removed', '          node ../scripts/ci/validate-deepsec-workflow.js --receipt', '          echo receipt-disabled #'],
    ['failure gate removed', '        if: failure()', '        if: success()'],
    ['false findings claim', 'Weekly scan failed', 'Weekly scan findings'],
    ['run link removed', '/actions/runs/${{ github.run_id }}', '/actions'],
  ];

  for (const [name, before, after] of mutations) {
    if (!workflow.includes(before)) throw new Error(`self-test fixture missing mutation anchor: ${name}`);
    const mutated = workflow.replace(before, after);
    const failures = validateWorkflow(mutated);
    if (failures.length === 0) throw new Error(`self-test did not reject: ${name}`);
  }

  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'deepsec-receipt-test-'));
  const fixture = (name, setup) => {
    const dir = path.join(root, name);
    fs.mkdirSync(dir);
    setup(dir);
    return dir;
  };

  try {
    const startedAt = Math.floor(Date.now() / 1000);
    const validDir = fixture('valid', (dir) => writeReceipt(dir));
    validateReceipt(validDir, startedAt);
    expectFailure('missing directory', 'receipt directory is missing', () => validateReceipt(path.join(root, 'missing'), startedAt));
    expectFailure('empty directory', 'expected exactly one receipt JSON', () => validateReceipt(fixture('empty', () => {}), startedAt));
    expectFailure('malformed JSON', 'receipt is not valid JSON', () => validateReceipt(fixture('malformed', (dir) => fs.writeFileSync(path.join(dir, 'bad.json'), '{')), startedAt));
    expectFailure('multiple receipts', 'expected exactly one receipt JSON', () => validateReceipt(fixture('multiple', (dir) => {
      writeReceipt(dir);
      fs.writeFileSync(path.join(dir, 'extra.json'), '{}');
    }), startedAt));
    for (const [name, overrides] of [
      ['wrong-project', { projectId: 'other' }],
      ['wrong-type', { type: 'report' }],
      ['incomplete', { phase: 'running' }],
      ['no-completion', { completedAt: null }],
      ['completion-before-start', { createdAt: '2026-07-22T00:00:01.000Z', completedAt: '2026-07-22T00:00:00.000Z' }],
      ['non-iso-date', { createdAt: new Date().toUTCString(), completedAt: new Date().toUTCString() }],
      ['invalid-run-id', { runId: '../escape' }],
      ['zero-files', { stats: { filesScanned: 0, candidatesFound: 0 } }],
      ['invalid-candidates', { stats: { filesScanned: 1, candidatesFound: -1 } }],
      ['absent-candidates', { stats: { filesScanned: 1 } }],
    ]) {
      const expected = {
        'wrong-project': 'projectId',
        'wrong-type': 'type must be scan',
        incomplete: 'phase must be done',
        'no-completion': 'completedAt must be an ISO-8601',
        'completion-before-start': 'completedAt must not precede createdAt',
        'non-iso-date': 'createdAt must be an ISO-8601',
        'invalid-run-id': 'runId must be a safe',
        'zero-files': 'filesScanned',
        'invalid-candidates': 'candidatesFound',
        'absent-candidates': 'candidatesFound',
      }[name];
      const receiptStartedAt = name === 'completion-before-start' ? undefined : startedAt;
      expectFailure(name, expected, () => validateReceipt(fixture(name, (dir) => writeReceipt(dir, overrides)), receiptStartedAt));
    }
    const staleDate = new Date((startedAt - 60) * 1000).toISOString();
    expectFailure('stale receipt', 'predates this scan', () => validateReceipt(fixture('stale', (dir) => {
      writeReceipt(dir, { createdAt: staleDate, completedAt: staleDate });
    }), startedAt));
    expectFailure('symlink receipt', 'receipt must be a regular file', () => validateReceipt(fixture('symlink', (dir) => {
      const outside = path.join(root, 'outside.json');
      fs.writeFileSync(outside, '{}');
      fs.symlinkSync(outside, path.join(dir, 'receipt.json'));
    }), startedAt));
    const realDir = fixture('real-directory', (dir) => writeReceipt(dir));
    const linkedDir = path.join(root, 'linked-directory');
    fs.symlinkSync(realDir, linkedDir);
    expectFailure('symlink directory', 'receipt directory must be a real directory', () => validateReceipt(linkedDir, startedAt));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  return { workflowMutations: mutations.length, receiptCases: 18 };
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--receipt') {
    const resultDir = args[1];
    const startedAtIndex = args.indexOf('--started-at');
    const startedAt = startedAtIndex === -1 ? undefined : Number(args[startedAtIndex + 1]);
    if (!resultDir) throw new Error('--receipt requires a directory');
    if (startedAtIndex !== -1 && (!Number.isInteger(startedAt) || startedAt <= 0)) {
      throw new Error('--started-at requires a positive epoch second');
    }
    const result = validateReceipt(path.resolve(resultDir), startedAt);
    console.log(`Deepsec receipt valid: run=${result.runId} files=${result.filesScanned} candidates=${result.candidatesFound}`);
    return;
  }

  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  if (args[0] === '--self-test') {
    const result = runSelfTests(workflow);
    console.log(`Deepsec validator self-test passed: workflow_mutations=${result.workflowMutations} receipt_cases=${result.receiptCases}`);
    return;
  }

  const failures = validateWorkflow(workflow);
  if (failures.length > 0) throw new Error(`Deepsec workflow contract failed:\n- ${failures.join('\n- ')}`);
  console.log('Deepsec workflow contract passed');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
