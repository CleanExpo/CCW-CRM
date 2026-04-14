/**
 * CCW Boardroom — Pre-flight Endpoint Validation (UNI-1669)
 *
 * Validates all critical endpoints before each session.
 * HALT rule: any failure aborts the session and alerts CEO.
 */

/**
 * Endpoints to validate before every boardroom session.
 * Optional endpoints (YouTube, ElevenLabs) are flagged but don't halt in demo mode.
 */
const REQUIRED_ENDPOINTS = [
  { name: 'Anthropic API', url: 'https://api.anthropic.com/v1/models', required: true },
  { name: 'Perplexity API', url: 'https://api.perplexity.ai/chat/completions', required: true },
  { name: 'CCW Website', url: 'https://www.carpetcleanerswarehouse.com.au', required: true },
];

const OPTIONAL_ENDPOINTS = [
  { name: 'Apify API', url: 'https://api.apify.com/v2/acts', required: false },
  { name: 'ElevenLabs API', url: 'https://api.elevenlabs.io/v1/voices', required: false },
  { name: 'YouTube API', url: 'https://www.googleapis.com/youtube/v3/channels', required: false },
];

/**
 * Run pre-flight checks for all endpoints.
 * Required endpoints failing will throw and halt the session.
 * Optional endpoint failures are logged as warnings (demo mode continues).
 *
 * @param {string} sessionId - Current session ID for header tracking
 * @returns {Promise<{passed: string[], warned: string[]}>}
 * @throws {Error} If any required endpoint fails
 */
export async function preFlightCheck(sessionId) {
  const allEndpoints = [...REQUIRED_ENDPOINTS, ...OPTIONAL_ENDPOINTS];

  console.log(`[Pre-flight] Checking ${allEndpoints.length} endpoints for session ${sessionId}...`);

  const results = await Promise.allSettled(
    allEndpoints.map(async (endpoint) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch(endpoint.url, {
          method: 'HEAD',
          headers: { 'X-Claude-Code-Session-Id': sessionId },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        // Accept any response below 500 as "reachable"
        const ok = res.status < 500;
        return { name: endpoint.name, ok, status: res.status, required: endpoint.required };
      } catch (err) {
        return {
          name: endpoint.name,
          ok: false,
          status: 0,
          required: endpoint.required,
          error: err.message,
        };
      }
    })
  );

  const passed = [];
  const warned = [];
  const failed = [];

  for (const result of results) {
    const r =
      result.status === 'fulfilled' ? result.value : { name: 'Unknown', ok: false, required: true };
    if (r.ok) {
      passed.push(r.name);
      console.log(`[Pre-flight] ✅ ${r.name} (${r.status})`);
    } else if (r.required) {
      failed.push(r.name);
      console.error(`[Pre-flight] ❌ REQUIRED: ${r.name} (${r.status || r.error})`);
    } else {
      warned.push(r.name);
      console.warn(`[Pre-flight] ⚠️  OPTIONAL: ${r.name} — demo mode will skip`);
    }
  }

  if (failed.length > 0) {
    const msg = `Pre-flight FAILED — required endpoints unreachable: ${failed.join(', ')}`;
    console.error(`[Pre-flight] ${msg}`);
    console.error('[Pre-flight] HALTING session — CEO must be notified.');
    // TODO: Notify CEO via Slack webhook when SLACK_WEBHOOK_URL is configured
    throw new Error(msg);
  }

  console.log(
    `[Pre-flight] PASSED ✅ — ${passed.length} endpoints healthy, ${warned.length} optional skipped`
  );
  return { passed, warned };
}
