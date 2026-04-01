# SKILL: Request Code Review (UNI-1742)

**When to use**: When you have completed an implementation and need to trigger the review pipeline before creating a PR.

## Steps

1. **Run pre-review checks**
   ```bash
   npx tsc --noEmit        # TypeScript must pass
   pnpm turbo run lint      # Lint must pass
   node scripts/ci/scan-secrets.js  # No secrets
   ```

2. **Analyse diff size**
   ```bash
   node -e "const {analyzeDiff,checkPRSize}=require('./scripts/lib/review-pipeline'); const d=analyzeDiff('develop'); console.log(checkPRSize(d));"
   ```
   - WARN if > 500 lines — consider splitting
   - BLOCK if > 1000 lines — must split before review

3. **Identify required reviewers**
   ```bash
   node -e "const {analyzeDiff,routeReviewers}=require('./scripts/lib/review-pipeline'); const d=analyzeDiff('develop'); console.log(routeReviewers(d).map(r=>r.name));"
   ```

4. **Dispatch to Review Orchestrator**
   ```
   @review-orchestrator Please review this PR:
   - Branch: [current branch]
   - Base: develop
   - Summary: [what changed and why]
   - Linear: UNI-XXXX
   ```

5. **Wait for verdict**
   - `SHIP` → proceed to create PR
   - `NEEDS_WORK` → fix findings, re-request review
   - `BLOCK` → STOP. Escalate to Phill if unsure how to fix

6. **Create PR after SHIP verdict**
   ```bash
   gh pr create --base develop --title "feat(scope): description" --body "$(cat .github/PULL_REQUEST_TEMPLATE.md)"
   ```

## Notes
- Never create a PR without a SHIP verdict from Review Orchestrator
- Security findings are never negotiable — fix all CRITICAL/HIGH before proceeding
- If review takes > 5 minutes, something is wrong — check agent logs
