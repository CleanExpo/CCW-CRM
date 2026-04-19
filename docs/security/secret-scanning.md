# Secret Scanning — CCW-ERP

**Ticket:** UNI-1910  
**Added:** 2026-04-19  
**Tool:** TruffleHog v3 (`trufflesecurity/trufflehog@v3`)

---

## Overview

Every pull request is automatically scanned for leaked secrets before any backend tests run. The scanner checks only the diff between the PR base and head — it does not re-scan the entire history on each run.

If a high-confidence secret is detected, the `secret-scan` job fails and the PR is blocked from merging.

---

## CI Job

**Job name:** `secret-scan` (runs before `backend-tests`)  
**Workflow:** `.github/workflows/ci.yml`

```yaml
secret-scan:
  name: Secret Scan (trufflehog)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: trufflesecurity/trufflehog@v3
      with:
        path: ./
        base: ${{ github.event.pull_request.base.sha || github.event.before }}
        head: ${{ github.event.pull_request.head.sha || github.sha }}
        extra_args: --only-verified --fail
```

**Flags:**

- `--only-verified` — only fails on secrets that TruffleHog can verify as active against the issuing service (reduces false positives)
- `--fail` — exits non-zero if any verified secret is found (blocks the PR)
- `fetch-depth: 0` — full git history required so TruffleHog can diff base..head

---

## What Gets Scanned

TruffleHog detects 700+ secret types including:

- AWS access keys and session tokens
- GitHub personal access tokens and app credentials
- Supabase service role keys and JWT secrets
- Stripe live keys
- Sentry DSNs
- Database connection strings with embedded credentials
- Generic high-entropy strings matching known patterns

---

## When a Secret Is Found

1. The `secret-scan` job fails — PR cannot merge
2. Open the failed job in GitHub Actions to see which file/line
3. **Immediately rotate the secret** — assume it is compromised
4. Remove the secret from the code and add it to `.gitignore` / environment variables
5. If the secret was committed to `main`, treat as an incident:
   - Rotate immediately
   - Review access logs for the affected service
   - Document in `.claude/memory/decisions-log.md`

---

## False Positives

If the scanner flags a string that is not a real secret (e.g. a test fixture, a placeholder value):

1. Confirm the string is truly not sensitive
2. Add a `.trufflehog.toml` exclusion at the repo root:

```toml
[rules]
exclude = [
  "path/to/test/fixture.py",
]
```

Do **not** add `--no-verify` to bypass verification globally.

---

## Related

- Burned credential incident: `.claude/memory/` → `project_burned_credential.md`
- Environment variable management: `apps/backend/.env.example`
- Rotate production DB password: Supabase dashboard → Settings → Database

---

## Skipping the Scan (Emergency Only)

Add `[skip secret-scan]` to the PR title. This should only be used for bot-generated PRs or documentation-only changes where there is zero possibility of secrets. Requires team lead approval.
