/**
 * sandbox.js — Containerised CRON Execution Wrapper
 * UNI-1730 [C12] — Sandboxing
 *
 * Wraps CRON script execution in Docker with:
 * - Memory limit (512MB)
 * - CPU limit (1 core)
 * - 10-minute timeout
 * - Network mode: none by default
 * - Read-only root filesystem
 * - No new privileges
 * - Whitelisted env vars only
 */

'use strict';

const { execFileSync, execFile } = require('child_process');
const path = require('path');

const SANDBOX_CONFIG = {
  image: 'ccw-cron-sandbox:latest',
  memoryLimit: '512m',
  cpuLimit: '1.0',
  timeout: 600,        // 10 minutes max
  networkMode: 'none', // no egress by default
  readOnlyRootfs: true,
  noNewPrivileges: true,
  allowedEnv: [
    'CCW_SESSION_ID',
    'CCW_CRON_TRIGGER',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NODE_ENV',
    'CCW_INPUT_TOKENS',
    'CCW_OUTPUT_TOKENS',
  ],
};

/**
 * Build the sandbox Docker image.
 */
function buildSandboxImage() {
  const dockerfilePath = path.join(process.cwd(), 'docker', 'cron-sandbox');
  execFileSync('docker', ['build', '-t', SANDBOX_CONFIG.image, dockerfilePath], {
    stdio: 'inherit',
  });
}

/**
 * Run a script inside the sandbox container.
 *
 * @param {string} script - Script path relative to /app inside container
 * @param {object} env - Environment variables to pass (filtered by allowedEnv)
 * @returns {{ success: boolean, output?: string, error?: string, timedOut?: boolean, exitCode?: number }}
 */
function runInSandbox(script, env = {}) {
  const args = [
    'run', '--rm',
    `--memory=${SANDBOX_CONFIG.memoryLimit}`,
    `--cpus=${SANDBOX_CONFIG.cpuLimit}`,
    `--network=${SANDBOX_CONFIG.networkMode}`,
    '--read-only',
    '--security-opt=no-new-privileges:true',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
  ];

  // Only pass whitelisted env vars
  const mergedEnv = { ...process.env, ...env };
  for (const key of SANDBOX_CONFIG.allowedEnv) {
    if (mergedEnv[key]) {
      args.push('-e', `${key}=${mergedEnv[key]}`);
    }
  }

  args.push(SANDBOX_CONFIG.image, 'node', script);

  try {
    const output = execFileSync('docker', args, {
      timeout: SANDBOX_CONFIG.timeout * 1000,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timedOut: error.killed || false,
      exitCode: error.status,
    };
  }
}

/**
 * Run a script with restricted network access (for Supabase/API calls).
 *
 * @param {string} script
 * @param {object} env
 * @param {string[]} allowedHosts - List of allowed hosts (informational — implement via Docker network)
 * @returns {ReturnType<runInSandbox>}
 */
function runWithNetwork(script, env = {}, allowedHosts = []) {
  const networkMode = allowedHosts.length > 0 ? 'ccw-restricted' : 'none';
  const args = [
    'run', '--rm',
    `--memory=${SANDBOX_CONFIG.memoryLimit}`,
    `--cpus=${SANDBOX_CONFIG.cpuLimit}`,
    `--network=${networkMode}`,
    '--read-only',
    '--security-opt=no-new-privileges:true',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
  ];

  const mergedEnv = { ...process.env, ...env };
  for (const key of SANDBOX_CONFIG.allowedEnv) {
    if (mergedEnv[key]) {
      args.push('-e', `${key}=${mergedEnv[key]}`);
    }
  }

  args.push(SANDBOX_CONFIG.image, 'node', script);

  try {
    const output = execFileSync('docker', args, {
      timeout: SANDBOX_CONFIG.timeout * 1000,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timedOut: error.killed || false,
      exitCode: error.status,
    };
  }
}

/**
 * Check if Docker is available on the host.
 * @returns {boolean}
 */
function isDockerAvailable() {
  try {
    execFileSync('docker', ['info'], { stdio: 'pipe' });
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  buildSandboxImage,
  runInSandbox,
  runWithNetwork,
  isDockerAvailable,
  SANDBOX_CONFIG,
};
