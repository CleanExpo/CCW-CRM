# UNI-1758 — Render OOM diagnosis (scoping, not a PR)

**Status**: SCOPED, NOT SHIPPED. Recommendation is an env-var flip in Render UI that Phill owns — no code change, no container rebuild.
**Why scoped-not-shipped**: Demo is on 2026-04-20. Static analysis strongly implicates two causes (worker count × heavy import graph), but without live memory graphs from Render + BetterStack I cannot prove which one dominates. Ship the low-risk env flip first, measure, then fix properly post-demo.

---

## What UNI-1758 probably wants

The ticket title is "Render OOM". Based on a static audit of `apps/backend/Dockerfile`, `apps/backend/Procfile`, `apps/backend/pyproject.toml`, and `apps/backend/src/api/main.py`, two independent factors compound into a process that is very likely hitting the Render memory ceiling:

### Factor 1 — Dockerfile pins 2 workers

`apps/backend/Dockerfile` line 68:

```dockerfile
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

Two workers × per-worker resident memory = double the import cost. If Render auto-detects the Docker build (no `render.yaml` is present in the repo), this is the command it uses.

### Factor 2 — Heavy import graph at module load time

`apps/backend/src/api/main.py` eagerly imports ~32 route modules, ~16 integration submodules, and the LangChain/LangGraph/Anthropic/OpenAI stack at module level (lines 31–123). Per-worker base image before the first request handles:

- `langchain`, `langchain-community`, `langchain-core`, `langgraph` (≥250–350 MB combined, transitive)
- `anthropic`, `openai`, `ollama` clients
- `supabase>=2.0.0` (pulls gotrue, postgrest, realtime, storage3)
- `sqlalchemy` + full ORM model graph (78 route modules, most importing db models)
- `pgvector`, `sentry-sdk[fastapi]`, `prometheus-fastapi-instrumentator`, `apscheduler`, `slowapi`, `sse-starlette`, `logtail-python`

Realistic per-worker resident memory at idle: **350–500 MB**.

### Factor 3 — Lifespan inflates memory further

`apps/backend/src/api/main.py` lines 129–220 run on startup:

- Initialize 3 specialized agents + supervisor agent, registered in a module-level registry held for the worker's lifetime.
- `get_health_monitor().start()` — background task, lives for the worker's lifetime.
- `learning_engine.load_patterns_from_db()` — **unbounded read** of the patterns table into in-process memory.
- Redis client connection pool.

## Risk matrix

| Option | What | Blast radius | Demo risk |
|---|---|---|---|
| **A. Do nothing.** | Accept periodic OOM restarts. | High — OOM during demo = cold-start stall mid-demo. | **HIGH** |
| **B. Set `WEB_CONCURRENCY=1` in Render env UI.** | No code, no rebuild. Gunicorn/uvicorn reads this env. | Halves memory (roughly). Async still handles concurrency per worker. | **LOW** |
| **C. Dockerfile edit `--workers 2` → `--workers 1`.** | 1-char change, forces rebuild + redeploy. | Same effect as B but triggers a container restart. | **MEDIUM** (release risk on demo week) |
| **D. Lazy-load AI routes + bound learning-engine patterns.** | Real fix. Moves LangChain/LangGraph imports inside route handlers. Caps pattern load. | Largest reduction. Touches main.py + ai route modules. | **HIGH** (schema/behaviour risk; needs tests) |
| **E. Bump Render plan from Starter (512 MB) → Standard (2 GB).** | Spend money, ship no code. | Immediate resolution. | **LOW** (cost only) |

## My recommendation for the demo window

**Option B (env flip) as the demo-window mitigation.** Phill goes to the Render dashboard for the backend service → Environment → add `WEB_CONCURRENCY=1` → save. Render auto-restarts the service once. Expected result: resident memory drops ~40–50 %, OOM headroom returns.

**If Option B is not enough** (memory still tight at idle), fall back to **Option E** — temporary upgrade to the Standard plan for demo week, downgrade after.

**Do NOT ship Options C or D this week.** Both require container rebuild + redeploy; D also needs backend tests. Demo is 2 days away.

## Post-demo plan (Day 3+)

Ship Option D as a proper PR:

1. Move `langchain` / `langgraph` / `langchain_community` / `langchain_core` imports **inside** the route handlers in `src/api/routes/ai/*.py`, not at module top.
2. Remove the eager `from .routes.ai import ...` block at `main.py:98–103`; register AI routers via a late-bound function called only if `settings.ai_enabled`.
3. Bound `learning_engine.load_patterns_from_db()` with a `limit=1000` cap + mtime-based eviction.
4. Consider lazy-registering the 3 agents on first request instead of in lifespan.
5. Re-enable `--workers 2` in the Dockerfile only after verifying per-worker resident memory < 200 MB at idle.

Estimated effort for post-demo PR: 0.5–1 day + test pass + prod canary.

## How to verify Option B worked

### Before the change

1. In the Render dashboard, open the backend service → **Metrics** → **Memory**.
2. Note the current resident-memory plateau at idle (e.g. 470 MB).
3. Note the time-since-last-restart counter — OOM shows up as unexplained restarts.

### After the env flip

1. Wait ~2 minutes for Render to finish the auto-restart after saving `WEB_CONCURRENCY=1`.
2. Reload the Metrics page. Resident memory should drop to roughly 55–65 % of the previous plateau.
3. Open BetterStack, filter for source = `ccw-backend`, search `worker_exit`, `SIGKILL`, or `OOM`. In the 30 minutes after the restart there should be zero new rows.
4. Hit `/api/health` a few times. Response stays under 300 ms — no cold-start stalls.

## Files inspected (evidence)

| File | Relevant lines | Finding |
|---|---|---|
| `apps/backend/Dockerfile` | 68 | `CMD [..., "--workers", "2"]` — pinned at 2 workers |
| `apps/backend/Procfile` | 1 | `web: uv run uvicorn ... $PORT` — no workers flag (default 1) |
| `apps/backend/pyproject.toml` | 7–53 | LangChain stack + heavy clients in dependencies |
| `apps/backend/src/api/main.py` | 31–123 | 32 route modules + 16 integration submodules imported eagerly |
| `apps/backend/src/api/main.py` | 97–103 | AI routes wrapped in try/except ImportError but pkgs ARE installed → LangChain loads into every worker |
| `apps/backend/src/api/main.py` | 154–200 | Lifespan instantiates 3 agents + supervisor + health monitor + unbounded pattern load |
| `apps/backend/src/api/main.py` | 204–218 | Redis client initialized per worker |
| Repo root | — | No `render.yaml` — Render uses auto-detected Docker build |

## Open questions for Phill

1. **Which Render plan is the backend on?** (Starter = 512 MB, Standard = 2 GB.) If Starter, Option B is urgent; if Standard, the OOM symptom might be something else (leak, spike) and needs Render memory graph screenshots.
2. **When did OOMs start appearing?** Ties to either a new dependency (LangChain addition?) or a new feature that allocates large objects per request.
3. **Is there a BetterStack search for `SIGKILL` or `OOMKilled` with a timestamp?** Helps confirm the failure mode.

## Verification checklist (if Phill flips Option B)

1. **Where**: Render dashboard for the CCW backend service → Environment.
2. **How**: Add `WEB_CONCURRENCY=1` → Save Changes → wait for auto-restart.
3. **What to see**:
   - Render Metrics → Memory — plateau drops to 55–65 % of previous value within 5 minutes.
   - BetterStack — no new `worker_exit` / `SIGKILL` / `OOMKilled` rows for 30 minutes post-restart.
   - `/api/health` returns 200 with p95 < 300 ms.
4. **What NOT to see**:
   - 502s from Render ingress (would indicate the single worker is saturating).
   - New error rows in BetterStack with `event=worker_timeout`.
5. **Rollback**: If p95 latency degrades > 50 %, remove `WEB_CONCURRENCY=1` from Env → restart → revert to the prior behaviour.
