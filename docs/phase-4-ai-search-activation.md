# Phase 4 — AI Search & Recommendations: Activation Guide

> **Status (2026-04-11):** The code for Phase 4 is already shipped and tested.
> This guide covers the final activation steps needed to turn it on in production.

## What's already built

| Layer                   | File(s)                                                          | LOC           |
| ----------------------- | ---------------------------------------------------------------- | ------------- |
| DB schema               | `apps/backend/migrations/add_ai_search.sql`                      | 344           |
| SQLAlchemy models       | `apps/backend/src/db/ai_search_models.py`                        | 353           |
| Embedding service       | `apps/backend/src/services/embedding_service.py`                 | 396           |
| Semantic search service | `apps/backend/src/services/semantic_search_service.py`           | 618           |
| Search agent            | `apps/backend/src/ai/agents/specialized/search_agent.py`         | 355           |
| Recommendation agent    | `apps/backend/src/ai/agents/specialized/recommendation_agent.py` | —             |
| Search routes           | `apps/backend/src/api/routes/search.py`                          | 229           |
| Recommendation routes   | `apps/backend/src/api/routes/recommendations.py`                 | 282           |
| Integration tests       | `apps/backend/tests/integration/test_search.py`                  | 378           |
| Integration tests       | `apps/backend/tests/integration/test_recommendations.py`         | 469           |
| Backfill CLI            | `scripts/backfill_product_embeddings.py`                         | new (this PR) |

**Total shipped code:** ~3,400 lines. pgvector extension is enabled via
`supabase/migrations/00000000000002_enable_pgvector.sql`.

## Exposed API endpoints

### Search (`/api/search`)

| Method | Path                    | Purpose                                      |
| ------ | ----------------------- | -------------------------------------------- |
| POST   | `/api/search/`          | Unified search (semantic / hybrid / keyword) |
| GET    | `/api/search/semantic`  | Pure vector similarity                       |
| GET    | `/api/search/hybrid`    | Vector + BM25 blended (recommended)          |
| GET    | `/api/search/analytics` | Query volume, zero-result rate, top queries  |

### Recommendations (`/api/recommendations`)

| Method | Path                                                           | Purpose                                        |
| ------ | -------------------------------------------------------------- | ---------------------------------------------- |
| GET    | `/api/recommendations/similar/{product_id}`                    | "Products like this"                           |
| GET    | `/api/recommendations/frequently-bought-together/{product_id}` | Market-basket co-occurrences                   |
| GET    | `/api/recommendations/personalized/{customer_id}`              | Customer interaction-based                     |
| POST   | `/api/recommendations/track-interaction`                       | Log a view / add-to-cart / purchase            |
| POST   | `/api/recommendations/precompute`                              | Background pre-compute for fast reads          |
| POST   | `/api/recommendations/update-co-occurrences`                   | Refresh market-basket from one completed order |

All endpoints are protected by `Depends(get_current_user)` (UNI-1770).

## Activation checklist

### 1. Set `OPENAI_API_KEY` in production

The embedding service uses OpenAI's `text-embedding-3-small` (1536 dimensions).
Set the key in Railway (backend) and Vercel (if the frontend ever calls the
embedding endpoint directly):

```bash
railway variables set OPENAI_API_KEY=sk-proj-...
```

**Cost estimate:** `text-embedding-3-small` is $0.02 per 1M tokens. A catalog
of 5,000 products averaging ~100 tokens of text each = 500K tokens ≈ **$0.01
per full backfill.** Re-running the backfill is effectively free.

### 2. Apply the migrations to production

```bash
# From repo root
supabase db push
```

This applies `add_ai_search.sql` (product_embeddings, search_queries,
recommendations, customer_interactions, etc.).

### 3. Backfill product embeddings

Once the schema is live and the API key is set:

```bash
cd apps/backend
uv run python ../../scripts/backfill_product_embeddings.py
```

Options:

- `--language en|zh-CN|es|...` — generate for a specific language (default: `en`)
- `--force` — regenerate existing embeddings
- `--product-id <uuid> --product-id <uuid>` — limit to specific products

The script is idempotent and processes products in batches of 100 concurrently.
Re-run weekly or after any bulk catalog update.

### 4. Smoke-test the endpoints

With the backend running locally or staging:

```bash
# Semantic search
curl -s -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/search/semantic?query=power+drill+for+concrete&limit=5" | jq

# Similar products
curl -s -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/recommendations/similar/<product-uuid>?limit=5" | jq
```

Expected: non-empty `results` array, `query_time_ms` < 500ms on a warm DB.

### 5. Run the integration tests

```bash
cd apps/backend
uv run pytest tests/integration/test_search.py tests/integration/test_recommendations.py -v
```

All tests should pass against a seeded test database with embeddings backfilled.

## Operational notes

### Rotating to a different embedding provider

Today: `EmbeddingService.MODEL = "text-embedding-3-small"` (hardcoded).

To switch to a self-hosted model (e.g. sentence-transformers `all-MiniLM-L6-v2`
for zero-cost local inference), replace `_call_openai_embeddings()` in
`apps/backend/src/services/embedding_service.py` with a local inference path and
update `DIMENSIONS = 384` for MiniLM. **This changes the schema** — the
`product_embeddings.embedding` column is `vector(1536)`. A migration that
drops and re-creates the column at `vector(384)` would be required.

### Monitoring

The search agent logs every query with timing metadata. Check Supabase logs
or Grafana for:

- `api.search.query_time_ms` p95 < 500ms
- `api.search.zero_result_rate` < 10%
- `api.recommendations.cache_hit_rate` > 70% (after precompute runs)

### Re-running embeddings after a catalog update

The recommended pattern is a nightly cron job:

```bash
# In scripts/cron/ or as a scheduled task
cd apps/backend && uv run python ../../scripts/backfill_product_embeddings.py
```

Products that already have embeddings are skipped automatically (no API calls,
no cost). Only new or updated products trigger a regeneration.

## Linked issues

- **UNI-1770** (auth sweep, closed 2026-04-10) — protects all Phase 4 endpoints
- **Phase 4 / B1** in the hardening plan at `~/.claude/plans/reactive-chasing-bengio.md`
