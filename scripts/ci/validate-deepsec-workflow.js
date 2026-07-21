#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ID = 'CCW-CRM';
const WORKFLOW_PATH = path.resolve(
  process.cwd(),
  '.github/workflows/deepsec-weekly.yml',
);

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  return isMapping(value)
    && Object.keys(value).sort().join('\n') === [...expected].sort().join('\n');
}

function parseWorkflow(content, failures) {
  let yaml;
  try {
    yaml = require('yaml');
  } catch (error) {
    failures.push(`YAML parser is unavailable: ${error.message}`);
    return null;
  }

  const document = yaml.parseDocument(content, { merge: false, uniqueKeys: true });
  for (const error of [...document.errors, ...document.warnings]) {
    failures.push(`workflow YAML is invalid: ${error.message.split('\n')[0]}`);
  }
  if (failures.length > 0) return null;

  let usesIndirection = false;
  yaml.visit(document, {
    Node(_key, node) {
      if (yaml.isAlias(node) || node?.anchor) usesIndirection = true;
    },
  });
  if (usesIndirection) {
    failures.push('workflow YAML anchors and aliases are not allowed');
    return null;
  }

  try {
    const parsed = document.toJS({ maxAliasCount: 0 });
    if (!isMapping(parsed)) failures.push('workflow root must be a mapping');
    return parsed;
  } catch (error) {
    failures.push(`workflow YAML could not be resolved safely: ${error.message}`);
    return null;
  }
}

function requireNamedStep(steps, name, failures) {
  const matches = steps.filter((step) => isMapping(step) && step.name === name);
  if (matches.length !== 1) {
    failures.push(`${name} step must appear exactly once in jobs.deepsec.steps`);
    return null;
  }
  return matches[0];
}

function validateWorkflow(content) {
  const failures = [];
  const workflow = parseWorkflow(content, failures);
  if (!workflow) return failures;

  const triggers = workflow.on;
  if (!isMapping(triggers) || !Array.isArray(triggers.schedule)
      || !triggers.schedule.some((entry) => isMapping(entry) && typeof entry.cron === 'string')) {
    failures.push('weekly schedule is required');
  }
  if (!isMapping(triggers) || !Object.prototype.hasOwnProperty.call(triggers, 'workflow_dispatch')) {
    failures.push('manual trigger is required');
  }

  if (!hasExactKeys(workflow.permissions, ['contents', 'issues'])
      || workflow.permissions.contents !== 'read'
      || workflow.permissions.issues !== 'write') {
    failures.push('root permissions must be exactly contents: read and issues: write');
  }

  const deepsec = workflow.jobs?.deepsec;
  if (!isMapping(deepsec)) {
    failures.push('jobs.deepsec is required');
    return failures;
  }
  if (Object.prototype.hasOwnProperty.call(deepsec, 'permissions')) {
    failures.push('jobs.deepsec must inherit the exact root permissions without an override');
  }
  if (deepsec['runs-on'] !== 'ubuntu-latest') failures.push('Deepsec must run on Ubuntu');

  const steps = Array.isArray(deepsec.steps) ? deepsec.steps : [];
  if (!Array.isArray(deepsec.steps)) failures.push('jobs.deepsec.steps must be a sequence');
  const checkoutSteps = steps.filter((step) => isMapping(step) && step.uses === 'actions/checkout@v4');
  if (checkoutSteps.length !== 1 || !hasExactKeys(checkoutSteps[0], ['uses'])) {
    failures.push('checkout step must appear exactly once and use actions/checkout@v4');
  }

  const setupStep = requireNamedStep(steps, 'Setup Node.js', failures);
  if (setupStep && (!hasExactKeys(setupStep, ['name', 'uses', 'with'])
      || setupStep.uses !== 'actions/setup-node@v4'
      || !hasExactKeys(setupStep.with, ['node-version'])
      || setupStep.with['node-version'] !== '22')) {
    failures.push('Setup Node.js step must use actions/setup-node@v4 with Node 22');
  }

  const installStep = requireNamedStep(steps, 'Install dependencies', failures);
  const expectedInstall = 'cd .deepsec\nnpm install';
  if (installStep && (!hasExactKeys(installStep, ['name', 'run'])
      || installStep.run?.trimEnd() !== expectedInstall)) {
    failures.push('Install dependencies step must match the Deepsec workspace contract');
  }

  const scanStep = requireNamedStep(steps, 'Run Deepsec', failures);
  const expectedScan = 'cd .deepsec\nresult_root="$PWD/data/CCW-CRM"\nresult_dir="$result_root/runs"\nrm -rf "$result_root"\ntrap \'rm -rf "$result_root"\' EXIT\nscan_started_at=$(date +%s)\nnpx deepsec scan --project-id CCW-CRM\nnode ../scripts/ci/validate-deepsec-workflow.js --receipt "$result_dir" --started-at "$scan_started_at"';
  if (scanStep && (!hasExactKeys(scanStep, ['name', 'run'])
      || scanStep.run?.trimEnd() !== expectedScan)) {
    failures.push('Run Deepsec step must match the fail-closed scan and receipt contract');
  }
  if (typeof scanStep?.run === 'string'
      && /continue-on-error:\s*true|\|\|\s*true|set \+e/.test(scanStep.run)) {
    failures.push('Deepsec scan or receipt failure must not be masked');
  }

  const issueStep = requireNamedStep(steps, 'Open issue on scan failure', failures);
  const expectedIssueRun = '# Ensure labels exist\ngh label create "security" --color "d73a4a" --description "Security related" 2>/dev/null || true\ngh label create "deepsec" --color "7057ff" --description "Deepsec scan" 2>/dev/null || true\ngh label create "weekly-scan" --color "008672" --description "Weekly automated scan" 2>/dev/null || true\ngh issue create \\\n  --title "[deepsec] Weekly scan failed $(date +%Y-%m-%d)" \\\n  --label "security,deepsec,weekly-scan" \\\n  --body "The weekly Deepsec scan failed to complete or produce a valid receipt. See the exact run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"';
  if (issueStep && (!hasExactKeys(issueStep, ['name', 'if', 'run', 'env'])
      || issueStep.if !== 'failure()'
      || issueStep.run?.trimEnd() !== expectedIssueRun
      || !hasExactKeys(issueStep.env, ['GH_TOKEN'])
      || issueStep.env.GH_TOKEN !== '${{ secrets.GITHUB_TOKEN }}')) {
    failures.push('Open issue on scan failure step must match the guarded reporting contract');
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

  const workflowCases = [
    ['permission decoy in root env', 'root permissions must be exactly', workflow
      .replace(
        'permissions:\n  contents: read\n  issues: write',
        'permissions:\n  contents: write\n  issues: read\n\nenv:\n  contents: read\n  issues: write',
      )],
    ['failure gate on unrelated step', 'guarded reporting contract', workflow
      .replace('        if: failure()\n        run: |', '        if: success()\n        run: |')
      .replace(
        '      - name: Open issue on scan failure',
        '      - name: Failure-gate decoy\n        if: failure()\n        run: echo decoy\n      - name: Open issue on scan failure',
      )],
    ['permission decoy in wrong job', 'root permissions must be exactly', workflow
      .replace('  contents: read\n  issues: write', '  contents: write\n  issues: read')
      .replace(
        'jobs:\n',
        'jobs:\n  permission-decoy:\n    permissions:\n      contents: read\n      issues: write\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo decoy\n',
      )],
    ['permission decoy in scalar context', 'root permissions must be exactly', workflow.replace(
      'permissions:\n  contents: read\n  issues: write',
      'permissions:\n  contents: write\n  issues: read\n\nenv:\n  PERMISSION_DECOY: |\n    contents: read\n    issues: write',
    )],
    ['issue command outside guarded failure step', 'guarded reporting contract', workflow
      .replace('          gh issue create \\\n', '          echo issue-disabled \\\n')
      .replace(
        '      - name: Open issue on scan failure',
        '      - name: Issue-command decoy\n        run: |\n          gh issue create --body "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"\n      - name: Open issue on scan failure',
      )],
    ['duplicate root permissions key', 'workflow YAML is invalid', workflow.replace(
      'permissions:\n  contents: read\n  issues: write',
      'permissions:\n  contents: write\n  issues: read\npermissions:\n  contents: read\n  issues: write',
    )],
    ['permission anchor and alias', 'anchors and aliases are not allowed', workflow
      .replace('permissions:', 'permissions: &least-privilege')
      .replace('    runs-on: ubuntu-latest', '    permissions: *least-privilege\n    runs-on: ubuntu-latest')],
    ['misleading permission comments', 'root permissions must be exactly', workflow.replace(
      'permissions:\n  contents: read\n  issues: write',
      'permissions:\n  contents: write\n  issues: read\n# contents: read\n# issues: write',
    )],
  ];

  for (const [name, expectedFailure, mutated] of workflowCases) {
    const failures = validateWorkflow(mutated);
    if (failures.length === 0) throw new Error(`self-test did not reject: ${name}`);
    if (!failures.some((failure) => failure.includes(expectedFailure))) {
      throw new Error(`self-test ${name} failed for the wrong reason: ${failures.join('; ')}`);
    }
  }

  const reorderedWorkflow = workflow.replace(
    'permissions:\n  contents: read\n  issues: write\n\njobs:',
    'jobs:',
  ) + '\npermissions:\n  issues: write\n  contents: read\n';
  const reorderedFailures = validateWorkflow(reorderedWorkflow);
  if (reorderedFailures.length > 0) {
    throw new Error(`self-test rejected reordered valid YAML:\n- ${reorderedFailures.join('\n- ')}`);
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

  return {
    workflowMutations: mutations.length + workflowCases.length,
    workflowPositiveCases: 2,
    receiptCases: 18,
  };
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
    console.log(`Deepsec validator self-test passed: workflow_mutations=${result.workflowMutations} workflow_positive_cases=${result.workflowPositiveCases} receipt_cases=${result.receiptCases}`);
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
