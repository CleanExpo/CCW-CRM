# UNI-664 Implementation Plan: CI/CD Pipeline (Staging → Production)

**Issue:** Automate deployment flow: GitHub push → Vercel staging preview → manual approval gate → production push.
**Prerequisite for:** Phase D data layer and KPI dashboard releases.
**Created:** 2026-03-03
**Author:** Planning Agent

---

## Context (What Already Exists)

### Workflows Present in `.github/workflows/`

| File                    | Status              | Purpose                                                                                                                                                      |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ci.yml`                | Active              | Full CI: backend tests (pytest+postgres+redis), frontend tests (vitest), build check, Docker build, E2E (Playwright), accessibility tests, CI summary job    |
| `deploy-staging.yml`    | Active (incomplete) | Push-to-`main` triggers SSH-based staging deploy to `staging.ccw-erp.com`; but requires `STAGING_SSH_KEY/HOST/USER` secrets which are **not yet configured** |
| `deploy-production.yml` | Active (incomplete) | Manual `workflow_dispatch` only; requires checkbox confirmations + `PRODUCTION_SSH_KEY/HOST/USER` secrets which are **not yet configured**                   |
| `rollback.yml`          | Active              | Emergency rollback for staging or production; SSH-based                                                                                                      |
| `security.yml`          | Active              | Snyk (optional), NPM audit, Trivy, dependency review                                                                                                         |
| `e2e-tests.yml`         | Active (duplicate)  | Standalone E2E job; duplicates what `ci.yml` already does                                                                                                    |
| `agent-pr-checks.yml`   | Active              | Validates agent-generated PRs on `feature/agent-*` branches                                                                                                  |

### Key Findings

**Frontend (Vercel):**

- `apps/web/vercel.json` exists with `framework: nextjs`, region `syd1`, security headers, and 3 cron jobs.
- Vercel is confirmed as the frontend host; it can auto-deploy via GitHub integration (no token needed) OR via `amondnet/vercel-action` (needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).
- The example workflow `deploy-frontend.yml.example` uses `amondnet/vercel-action@v25` with `--prod` flag for `main` branch only.
- **Critical gap:** There is no Vercel-integrated PR preview comment bot wiring in any workflow. Vercel's GitHub app does previews automatically when the integration is enabled, but no workflow posts the preview URL back to the PR.

**Backend:**

- `apps/backend/Dockerfile` exists (Python 3.12-slim, uv, port 8000, health check at `/health`).
- `apps/web/Dockerfile` exists.
- `docker-compose.staging.yml` and `docker-compose.production.yml` both exist.
- The deploy workflows use SSH to pull images from GHCR and restart Docker Compose on a remote server.
- **Critical gap:** SSH secrets (`STAGING_SSH_KEY`, `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `PRODUCTION_SSH_KEY`, `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`) are documented in `.github/SECRETS.md` as required but NOT yet added to GitHub.

**Branch strategy:**

- `ci.yml` triggers on `main` and `ai-updates`.
- `deploy-staging.yml` triggers on push to `main` only.
- `deploy-production.yml` is `workflow_dispatch` only (manual gate exists in code but the GitHub Environment protection rules are not yet configured).
- **Gap:** No branch protection rules documented or enforced. `ai-updates` is the current working branch per git status, but the main deploy branch is `main`.

**Staging environment:**

- `deploy-staging.yml` references a GitHub Environment named `staging` (line: `environment: name: staging`). This environment must be created in GitHub repo Settings → Environments.
- `deploy-production.yml` references a GitHub Environment named `production` with a `url: https://ccw-erp.com`. This environment must be created and have **required reviewers** set to enforce the manual approval gate.

**Smoke tests:**

- `deployment/scripts/smoke-tests.sh` is a full bash smoke test suite (10 test categories: health, auth, products, customers, orders, quotes, dashboard, billing, rate limiting, security headers). It is referenced in `deploy-staging.yml` but the file is **not made executable** and the `chmod +x` step is missing.

**`.env` requirements:**

- Frontend needs: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET`, `WEBHOOK_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `NEXT_PUBLIC_ENVIRONMENT`, `RELEASE`
- Backend needs: `DATABASE_URL`, `JWT_SECRET_KEY`, `STRIPE_SECRET_KEY`, `SENTRY_DSN`, `SENTRY_RELEASE`, `CORS_ORIGINS`
- CI sets `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000` for build check — correct.

**Coverage threshold:** Backend tests use `--cov-fail-under=15` (15%) — intentionally low. This is not a blocker but should be noted.

**Known test failures (pre-existing):** `walk-in.test.tsx` (1 fail) and `service.test.tsx` (2 fails). These must be accounted for; they will cause `ci.yml` to fail on PRs if not excluded or fixed.

---

## Gaps Summary (What UNI-664 Must Deliver)

1. **GitHub Environments not created** — `staging` and `production` environments with secrets + protection rules must be configured.
2. **SSH secrets not added** — Staging and production SSH credentials not in GitHub Secrets.
3. **Branch protection rules not set** — `main` branch needs protection: require PR, require CI to pass, require review.
4. **PR preview URL bot missing** — No workflow posts Vercel preview URL as a PR comment.
5. **`ci.yml` does not gate staging deploy** — `deploy-staging.yml` runs tests again independently; the CI workflow result is not a prerequisite for the deploy workflow.
6. **Pre-existing test failures** — `walk-in.test.tsx` and `service.test.tsx` fail and block CI; must be fixed or excluded before branch protection can be enabled.
7. **`deploy-staging.yml` has a smoke-tests step that may fail** — `chmod +x` missing; billing API test expected to fail; rate limiting test makes 150 requests.
8. **`e2e-tests.yml` is a duplicate** — Runs the same E2E as `ci.yml`; creates confusion and wastes runner minutes.

---

## Sub-Tasks

### SUB-1: Fix Pre-existing Test Failures + E2E Duplication (S)

**Why first:** Branch protection rules cannot be enabled until CI passes reliably on every PR. The two pre-existing failures will block everything downstream.

**Files to create/modify:**

- `apps/web/__tests__/` — fix or skip `walk-in.test.tsx` and `service.test.tsx`
- `.github/workflows/e2e-tests.yml` — delete or repurpose (it duplicates `ci.yml`)

**Steps:**

1. Investigate `walk-in.test.tsx` and `service.test.tsx` failures:
   ```bash
   cd apps/web && pnpm test -- --reporter=verbose 2>&1 | grep -A 10 "FAIL"
   ```
2. Fix the root cause of each failure OR add `test.skip` with a comment linking to the backlog issue (UNI-1254 covers missing Vitest tests).
3. Confirm `pnpm turbo run test` passes with zero failures.
4. Delete `.github/workflows/e2e-tests.yml` (its logic is already in `ci.yml` under the `e2e-tests` job). This avoids double-billing runner minutes and confusing duplicate statuses on PRs.

**Acceptance criteria:**

- `pnpm turbo run test` exits 0 with no failures.
- Only one E2E workflow file exists (in `ci.yml`).
- `ci.yml` passes end-to-end on `main` and on a test PR.

**Complexity:** S

---

### SUB-2: Configure GitHub Environments + Secrets (M)

**Why:** The `staging` and `production` GitHub Environments must exist before any deploy workflow can reference them. The production environment needs **required reviewers** — this IS the manual approval gate.

**Files to create/modify:**

- GitHub repo Settings (no file change — UI/CLI configuration)
- `.github/SECRETS.md` — update to document new secrets added
- `.github/SECRETS-QUICK-START.md` — update with environment-scoped secrets note

**Steps:**

1. In GitHub repo Settings → Environments, create environment: **`staging`**
   - No required reviewers (auto-deploy on push to `main`)
   - Add environment secrets (scoped to staging only):
     - `STAGING_SSH_KEY` — private SSH key for the staging server
     - `STAGING_SSH_HOST` — IP or hostname of the staging server
     - `STAGING_SSH_USER` — SSH username (e.g., `ubuntu`)
     - `STAGING_API_URL` — `https://api.staging.ccw-erp.com`
   - Set environment URL: `https://staging.ccw-erp.com`

2. In GitHub repo Settings → Environments, create environment: **`production`**
   - Add **required reviewers**: at minimum 1 (the team lead or founder)
   - Set "Wait timer": optional (0–30 minutes cooldown after review)
   - Add environment secrets (scoped to production only):
     - `PRODUCTION_SSH_KEY`
     - `PRODUCTION_SSH_HOST`
     - `PRODUCTION_SSH_USER`
     - `PRODUCTION_API_URL` — `https://api.ccw-erp.com`
   - Set environment URL: `https://ccw-erp.com`

3. Add repository-level secrets (available to all environments):
   - `SLACK_WEBHOOK_URL` — for deploy notifications (optional but recommended)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — needed by `deploy-frontend.yml.example`

4. Update `.github/SECRETS.md` to mark staging/production SSH secrets as "now configured" and document that production secrets are environment-scoped.

**The manual approval gate is entirely delivered by GitHub Environments "required reviewers" on the `production` environment.** When `deploy-production.yml` runs, GitHub will pause at the `deploy` job (which uses `environment: name: production`) and send a notification to reviewers asking for approval. The job will not proceed until approved.

**Acceptance criteria:**

- `staging` environment exists in GitHub with correct secrets.
- `production` environment exists in GitHub with ≥1 required reviewer configured.
- Running `deploy-staging.yml` via `workflow_dispatch` completes without "secret not found" errors.
- Running `deploy-production.yml` via `workflow_dispatch` shows a pending approval gate before the deploy job starts.

**Complexity:** M

---

### SUB-3: Add PR Preview URL Comment Bot (S)

**Why:** The issue spec asks for "Vercel staging preview → manual approval gate". Vercel's GitHub app creates preview URLs automatically, but unless a workflow posts that URL as a PR comment, developers have to hunt for it. This closes the feedback loop for every PR.

**Files to create/modify:**

- `.github/workflows/ci.yml` — add a new job `post-preview-url` (or a step inside `build`)
- Alternatively: `.github/workflows/pr-preview-comment.yml` — new standalone workflow

**Option A (recommended): Add a job to `ci.yml`**

Add this job after the `build` job:

```yaml
post-preview-comment:
  name: Post Preview URL
  runs-on: ubuntu-latest
  needs: [build]
  if: github.event_name == 'pull_request'
  permissions:
    pull-requests: write

  steps:
    - name: Comment preview URL on PR
      uses: actions/github-script@v7
      with:
        script: |
          const prNumber = context.payload.pull_request.number;
          const sha = context.payload.pull_request.head.sha.slice(0, 7);
          const branch = context.payload.pull_request.head.ref
            .replace(/[^a-zA-Z0-9-]/g, '-')
            .toLowerCase()
            .slice(0, 63);

          // Vercel preview URL format: https://<project>-git-<branch>-<org>.vercel.app
          // or: https://<project>-<sha>-<org>.vercel.app
          // The exact URL is determined by Vercel. Use a direct deployment API call
          // if VERCEL_TOKEN is available, otherwise post the branch-based guess.

          const body = [
            '## Deployment Preview',
            '',
            `**Branch:** \`${context.payload.pull_request.head.ref}\``,
            `**Commit:** \`${sha}\``,
            '',
            '| Environment | URL | Status |',
            '|-------------|-----|--------|',
            `| Vercel Preview | [View Preview](https://ccw-erp-git-${branch}.vercel.app) | Vercel builds automatically |`,
            `| Staging API | [https://api.staging.ccw-erp.com/api/health](https://api.staging.ccw-erp.com/api/health) | Auto-deployed on merge to \`main\` |`,
            '',
            '_Production deployment requires manual approval after staging passes._',
          ].join('\n');

          // Delete previous preview comment if it exists
          const comments = await github.rest.issues.listComments({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: prNumber,
          });

          const existing = comments.data.find(c =>
            c.user.type === 'Bot' && c.body.includes('## Deployment Preview')
          );

          if (existing) {
            await github.rest.issues.updateComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              comment_id: existing.id,
              body,
            });
          } else {
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: prNumber,
              body,
            });
          }
```

**Steps:**

1. Add the `post-preview-comment` job to `.github/workflows/ci.yml` after the `build` job.
2. Add `permissions: pull-requests: write` at the workflow level (or job level — job level is safer).
3. If `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` are available as repository secrets, enhance the step to call Vercel's Deployments API to get the exact preview URL for this commit SHA instead of constructing a guess.

**Acceptance criteria:**

- Opening a PR against `main` causes a bot comment to appear on the PR with a Deployment Preview table.
- Pushing a new commit to the PR updates the existing comment (not duplicates).
- The comment includes links to both the Vercel preview and the staging API health check.

**Complexity:** S

---

### SUB-4: Enforce Branch Protection on `main` (S)

**Why:** Without branch protection, anyone can push directly to `main`, bypassing CI and triggering a broken staging deploy. Branch protection is the enforcement layer that makes the entire CI/CD pipeline meaningful.

**Files to create/modify:**

- GitHub repo Settings (UI/CLI configuration — no file change)
- `.github/README.md` — document the protection rules that are in place

**Steps:**

1. In GitHub repo Settings → Branches, add a branch protection rule for `main`:
   - **Require a pull request before merging**: ON
     - Required approving reviews: 1
     - Dismiss stale pull request approvals when new commits are pushed: ON
   - **Require status checks to pass before merging**: ON
     - Required status checks (exact names from `ci.yml`):
       - `Backend Tests`
       - `Frontend Tests`
       - `Build Check`
     - Require branches to be up to date before merging: ON
   - **Require conversation resolution before merging**: ON
   - **Do not allow bypassing the above settings**: ON (even for admins)
   - **Restrict who can push to matching branches**: leave open OR restrict to maintainers

2. Also protect `ai-updates` (the current working branch) with lighter rules:
   - Require status checks: `Backend Tests`, `Frontend Tests`
   - No required reviews (allow solo work on feature branch)

3. Update `.github/README.md` to document the branch protection strategy.

**Note:** Step 1 cannot be completed until SUB-1 (test failures fixed) is done. If CI is currently failing, enabling "require status checks" will immediately block all merges.

**Acceptance criteria:**

- Direct push to `main` is blocked (only PRs accepted).
- A PR to `main` with failing CI cannot be merged.
- A PR to `main` with passing CI but no review cannot be merged.
- `ai-updates` still allows solo pushes but CI must pass.

**Complexity:** S

---

### SUB-5: Wire CI as a Prerequisite for Staging Deploy (M)

**Why:** Currently `deploy-staging.yml` re-runs tests from scratch, wasting ~5 minutes of runner time per deploy. The correct pattern is: CI must pass first on `main`, then staging deploy triggers. This ensures staging only receives verified code.

The structural issue: `deploy-staging.yml` triggers on `push` to `main` in parallel with `ci.yml`. There is no dependency between them. If `ci.yml` fails and `deploy-staging.yml` also happens to be triggered, a broken deploy can still land on staging.

**Files to modify:**

- `.github/workflows/deploy-staging.yml` — change the trigger to depend on `ci.yml` completion
- `.github/workflows/ci.yml` — add `on.push.branches: [main]` workflow result output (already present)

**Steps:**

1. Change `deploy-staging.yml` trigger from:

   ```yaml
   on:
     push:
       branches: [main]
   ```

   To:

   ```yaml
   on:
     workflow_run:
       workflows: ['CI']
       types: [completed]
       branches: [main]
   ```

2. Add a gate job at the top of `deploy-staging.yml` to abort if CI failed:

   ```yaml
   gate:
     name: CI Gate
     runs-on: ubuntu-latest
     if: github.event.workflow_run.conclusion == 'success'
     steps:
       - name: CI passed
         run: echo "CI passed, proceeding with staging deploy"
   ```

   Then make all other jobs `needs: [gate]`.

3. Remove the duplicate `test` job from `deploy-staging.yml` (lines 68–141). The CI workflow already ran and passed — re-running tests is redundant. Replace with a lightweight check that the correct Docker images were built for this SHA.

4. Fix the smoke tests step in `deploy-staging.yml`:
   - Add `chmod +x deployment/scripts/smoke-tests.sh` before calling it.
   - The billing test (test 8.1) currently logs a failure even when the billing API is not implemented. Add `|| true` or make that test `continue-on-error: true` in the workflow step while the billing API is still being built.

**Acceptance criteria:**

- A push to `main` that causes `ci.yml` to fail does NOT trigger a staging deploy.
- A push to `main` where `ci.yml` passes automatically triggers a staging deploy.
- The smoke tests complete without false failures from the billing endpoint.
- The total staging deploy workflow duration is reduced by ~5 minutes (no re-running tests).

**Complexity:** M

---

### SUB-6: Activate the Vercel Frontend Deployment Workflow (M)

**Why:** The `deploy-frontend.yml.example` is a template but is not active. Vercel can be configured two ways:

1. **GitHub App integration (no token needed)** — Vercel automatically deploys every push and PR via its GitHub App. This is already likely active since the project is "deployed on Vercel".
2. **Programmatic via Actions** — Uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Needed for staging vs production separation or to inject environment-specific build args.

The problem: `vercel.json` does not distinguish staging from production. A single Vercel project auto-deploys all branches. For true staging → production separation on the frontend, either:

- Use **two Vercel projects** (one for staging, one for production), OR
- Use **Vercel preview** (PR previews) as "staging", and the **production deployment** (triggered by merge to `main`) as "production".

**The recommended approach for CCW given it is already on Vercel:** Use Vercel's built-in flow — PR previews are "staging", merge to `main` promotes to production. Add a workflow step that waits for Vercel's deployment to complete and posts the production URL to the deployment summary.

**Files to create/modify:**

- `.github/workflows/deploy-production.yml` — add a frontend verification step after backend deploy
- `.github/workflows/ci.yml` — the `post-preview-comment` job from SUB-3 handles PR previews

**Steps:**

1. Confirm Vercel GitHub App integration is active by checking if pushes to `main` automatically trigger a Vercel production deployment at the project URL. If yes, no workflow change is needed for the frontend — Vercel handles it natively.

2. If Vercel GitHub App integration is NOT active, copy `deploy-frontend.yml.example` to an active workflow:

   ```bash
   cp .github/workflows/examples/deploy-frontend.yml.example \
      .github/workflows/deploy-frontend.yml
   ```

   Then add secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` to the GitHub repo.

3. In `deploy-production.yml`, add a post-deploy step that verifies the Vercel production URL is live:

   ```yaml
   - name: Verify Vercel production deployment
     run: |
       MAX_RETRIES=10
       for i in $(seq 1 $MAX_RETRIES); do
         HTTP=$(curl -s -o /dev/null -w "%{http_code}" https://ccw-erp.com || echo "000")
         if [ "$HTTP" = "200" ]; then
           echo "Vercel production is live (HTTP $HTTP)"
           exit 0
         fi
         echo "Attempt $i/$MAX_RETRIES: HTTP $HTTP — waiting 15s"
         sleep 15
       done
       echo "Vercel production did not respond after $MAX_RETRIES attempts"
       exit 1
   ```

4. Update `vercel.json` to explicitly set `NEXT_PUBLIC_ENVIRONMENT` per environment using Vercel's environment variable scoping (done in Vercel dashboard, not in `vercel.json`):
   - Preview: `NEXT_PUBLIC_ENVIRONMENT=staging`
   - Production: `NEXT_PUBLIC_ENVIRONMENT=production`
   - `NEXT_PUBLIC_BACKEND_URL` pointing to staging vs production API

**Acceptance criteria:**

- Every PR gets a Vercel preview URL automatically.
- Merging to `main` triggers a Vercel production deploy AND a backend staging deploy.
- Production backend deploy (via `deploy-production.yml` with approval gate) is followed by a Vercel production URL health check.
- `NEXT_PUBLIC_ENVIRONMENT` is set to `staging` on preview deployments and `production` on the production Vercel project.

**Complexity:** M

---

## Dependencies & Risks

### Dependency Graph

```
SUB-1 (fix tests)
  └── SUB-4 (branch protection) — cannot enable required status checks until CI passes
        └── All future PRs to main are protected

SUB-2 (environments + secrets)
  └── SUB-5 (wire CI → staging) — staging deploy needs SSH secrets to work
        └── SUB-6 (Vercel frontend) — production verification needs stable staging

SUB-3 (PR preview bot) — independent, can be done any time
```

### Risks

| Risk                                                               | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSH staging/production server not provisioned                      | Medium     | High   | `deploy-staging.yml` + docs reference a server at `staging.ccw-erp.com` that may not exist yet. If it does not exist, all SSH-based deploy steps will fail. Verify the server exists before adding secrets in SUB-2.                                                                                                                                                                      |
| Vercel GitHub App already active, creating duplicate deploys       | Low        | Medium | Check Vercel project settings before implementing SUB-6. If GitHub App is active, adding a second workflow deploy step could double-deploy or conflict.                                                                                                                                                                                                                                   |
| `walk-in.test.tsx` / `service.test.tsx` failures are hard to fix   | Medium     | High   | If fixing them is complex (external dependencies, mocking issues), use `test.skip` as a temporary measure with comments. Do not leave failing tests as-is.                                                                                                                                                                                                                                |
| `deploy-staging.yml` `workflow_run` trigger has a known limitation | Low        | Low    | `workflow_run` events do not carry the full PR context. Ensure the `validate` job correctly identifies the SHA from `github.event.workflow_run.head_sha`.                                                                                                                                                                                                                                 |
| Production environment protection requires GitHub Pro/Teams        | Low        | High   | GitHub Environment required reviewers are available on all plans for public repos, and on GitHub Pro / Teams / Enterprise for private repos. Confirm the repo plan before relying on this feature for the approval gate. If not available, an alternative is to use a separate `workflow_dispatch` with a boolean confirmation checkbox (already implemented in `deploy-production.yml`). |
| Coverage threshold at 15% allows very low test coverage            | Low        | Low    | Not a CI blocker but creates technical debt. Consider raising to 40% in a follow-up.                                                                                                                                                                                                                                                                                                      |

---

## Recommended Implementation Order

1. **SUB-1** — Fix test failures and remove duplicate E2E workflow. This unblocks everything. (1–2 hours)
2. **SUB-3** — Add PR preview comment bot. Quick win, visible to the team immediately. (1 hour)
3. **SUB-2** — Configure GitHub Environments and secrets. Requires infrastructure access (the staging server). (1–2 hours setup + infrastructure time)
4. **SUB-4** — Enable branch protection on `main`. Do this after SUB-1 passes CI and SUB-2 environments exist. (30 minutes)
5. **SUB-5** — Wire CI as staging deploy prerequisite; fix smoke tests. (2–3 hours)
6. **SUB-6** — Activate/verify Vercel frontend deployment. (1–2 hours, partially depends on Vercel dashboard access)

**Total estimated effort:** ~8–12 hours of engineering time, excluding infrastructure provisioning (staging server setup if not already done).

---

## Required GitHub Secrets Checklist

After UNI-664 is complete, the following secrets must be present:

### Repository-level secrets

| Secret                          | Required    | Notes                               |
| ------------------------------- | ----------- | ----------------------------------- |
| `SLACK_WEBHOOK_URL`             | Optional    | For deploy notifications            |
| `NEXT_PUBLIC_SUPABASE_URL`      | Recommended | Used in frontend build              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Recommended | Used in frontend build              |
| `VERCEL_TOKEN`                  | Optional    | Only if not using Vercel GitHub App |
| `VERCEL_ORG_ID`                 | Optional    | Only if not using Vercel GitHub App |
| `VERCEL_PROJECT_ID`             | Optional    | Only if not using Vercel GitHub App |

### `staging` environment secrets

| Secret             | Required                    |
| ------------------ | --------------------------- |
| `STAGING_SSH_KEY`  | Required for staging deploy |
| `STAGING_SSH_HOST` | Required for staging deploy |
| `STAGING_SSH_USER` | Required for staging deploy |
| `STAGING_API_URL`  | Required for smoke tests    |

### `production` environment secrets

| Secret                | Required                       |
| --------------------- | ------------------------------ |
| `PRODUCTION_SSH_KEY`  | Required for production deploy |
| `PRODUCTION_SSH_HOST` | Required for production deploy |
| `PRODUCTION_SSH_USER` | Required for production deploy |
| `PRODUCTION_API_URL`  | Required for health check      |

---

## Definition of Done for UNI-664

- [ ] `pnpm turbo run test` exits 0 with no failures (SUB-1)
- [ ] `ci.yml` runs successfully on every PR to `main`
- [ ] Every PR to `main` receives a bot comment with Vercel preview URL (SUB-3)
- [ ] GitHub `staging` environment exists with secrets configured (SUB-2)
- [ ] GitHub `production` environment exists with ≥1 required reviewer (SUB-2)
- [ ] `main` branch has protection rules: require PR + CI pass + 1 review (SUB-4)
- [ ] Push to `main` with passing CI automatically triggers staging deploy (SUB-5)
- [ ] Push to `main` with failing CI does NOT trigger staging deploy (SUB-5)
- [ ] `deploy-production.yml` pauses at the `deploy` job awaiting manual approval (SUB-2 + SUB-6)
- [ ] After production approval + deploy, both backend health check and Vercel frontend health check pass (SUB-6)
- [ ] Smoke tests on staging complete without false failures (SUB-5)
