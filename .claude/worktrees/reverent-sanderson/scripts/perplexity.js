/**
 * CCW Boardroom — Perplexity Intelligence Query Module (UNI-1668)
 *
 * All current-state intelligence MUST come from Perplexity.
 * Recency filter: 7 days maximum.
 */

/**
 * Query Perplexity for current intelligence on a topic.
 * Returns structured JSON with findings, sources, and date range.
 *
 * @param {string} topic - Research topic/query
 * @param {string} dateContext - Current date for recency anchoring
 * @returns {Promise<Object>} Perplexity response with citations
 */
export async function queryPerplexity(topic, dateContext = new Date().toLocaleDateString('en-AU')) {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('[Perplexity] Missing PERPLEXITY_API_KEY env var');
  }

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [
        {
          role: 'system',
          content: `You are a real-time research agent. Today is ${dateContext}.
Return ONLY information published or updated within the last 7 days.
Reject any information older than 7 days.
Always cite sources with URLs and publication dates.
Format output as structured JSON with fields: findings[], sources[], date_range.`,
        },
        { role: 'user', content: topic },
      ],
      return_citations: true,
      search_recency_filter: 'week',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[Perplexity] ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Run all 5 standard boardroom intelligence queries in parallel (Scout Swarm).
 * Returns array of results keyed by query index.
 *
 * @returns {Promise<Array>} Array of Perplexity responses
 */
export async function runScoutSwarm() {
  console.log('[Scout Swarm] Dispatching 5 parallel Perplexity queries...');
  const results = await Promise.allSettled(
    BOARDROOM_QUERIES.map((query, i) =>
      queryPerplexity(query).then((r) => ({ index: i, query, result: r }))
    )
  );

  const successful = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.filter((r) => r.status === 'rejected');

  if (failed.length > 0) {
    console.warn(
      `[Scout Swarm] ${failed.length} queries failed:`,
      failed.map((f) => f.reason?.message)
    );
  }

  console.log(`[Scout Swarm] ${successful.length}/5 queries completed ✅`);
  return successful;
}

/**
 * Standard boardroom intelligence queries — run every CRON cycle.
 * Covers: Anthropic updates, AU/NZ AI tools, YouTube strategy, industry news, CCW news.
 */
export const BOARDROOM_QUERIES = [
  'Latest Anthropic Claude API updates and developer news this week',
  'AI automation tools for trades businesses Australia New Zealand 2026',
  'YouTube B2B content strategy trends Australia this week',
  'Cleaning restoration industry news Australia 2026',
  'Unite-Group CCW carpet cleaners warehouse Australia news',
];
