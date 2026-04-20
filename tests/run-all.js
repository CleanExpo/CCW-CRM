#!/usr/bin/env node
/**
 * tests/run-all.js — Test Runner Orchestration
 * UNI-1721 [C2] — Test Suite
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

function findTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(full));
    } else if (entry.name.endsWith('.test.js')) {
      results.push(full);
    }
  }
  return results;
}

const testFiles = findTestFiles(__dirname);
let passed = 0;
let failed = 0;
const failures = [];

console.log(`\n[TEST-RUNNER] Found ${testFiles.length} test file(s)\n`);

for (const file of testFiles) {
  const relPath = path.relative(ROOT, file);
  try {
    execSync(`node "${file}"`, { stdio: 'pipe', cwd: ROOT });
    passed++;
    console.log(`  [PASS] ${relPath}`);
  } catch (e) {
    failed++;
    const errMsg = e.stdout
      ? e.stdout.toString().slice(0, 200)
      : e.stderr
        ? e.stderr.toString().slice(0, 200)
        : e.message;
    console.error(`  [FAIL] ${relPath}: ${errMsg}`);
    failures.push({ file: relPath, error: errMsg });
  }
}

console.log(
  `\n[TEST-RUNNER] ${passed} passed, ${failed} failed out of ${testFiles.length} test files\n`
);

if (failures.length > 0) {
  console.error('[TEST-RUNNER] Failures:');
  for (const f of failures) {
    console.error(`  - ${f.file}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
