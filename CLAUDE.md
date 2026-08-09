# CLAUDE.md — CCW-CRM

Instructions for any agent working in this repository. `AGENTS.md` points here so Cursor and
other tools inherit the same rules.

## Release law

**Human merge only. This project has no autonomy exception.** An agent's terminal state is a
green local branch and a report; a human takes it from there.

Before any `git push`, `gh pr create`, `gh pr ready` or `gh pr merge`, the change needs a
complete local definition of done (below) and an independent review bound to the **exact final
commit**. A PASS for an earlier SHA is not a PASS for this one.

**Treat opening a pull request as authorising its merge.** A PR that is visible is a PR someone
can merge, and you will not be there to object. Open one only when it is ready to land, keep it
draft until remote checks for that exact SHA are green, and never open a stream of replacement
PRs for the same scope — update the one coherent branch.

That rule stands on the risk itself, not on an anecdote. An earlier draft of this file justified
it with a specific claim about PR #281 being undrafted by someone else and automerged; checking
`gh pr view 281` showed `autoMergeRequest: null` with the same account opening and merging it, so
the claim was false and has been removed. Its presence here was the failure the next section
describes — a story repeated until it sounded like a measurement.

Never use `--no-verify`, never force push, and never set a release-gate override variable.

## Definition of done

Run all eleven, in this order, and paste the output. Green on all of them or it is not done:

```
npm run type-check
npm run lint
npm run test:coverage
npm run build
node scripts/ci/validate-hooks.js
node scripts/ci/validate-agents.js
node scripts/ci/validate-cron-jobs.js
node scripts/ci/validate-vercel-crons.js
node scripts/ci/validate-css-sources.js
node scripts/ci/validate-deepsec-workflow.js
node scripts/ci/scan-secrets.js
```

The seven validators are not optional extras — `.github/workflows/boardroom-ci.yml` runs them in
its `validate` and `security` jobs and they block the deploy gate. A definition of done that
stops at `build` sends you into CI believing you are green.

**A green suite is not evidence the data layer works.** The tests run without a database.
`src/lib/auth/__tests__/registration-postgres-concurrency.test.ts` gates on `TEST_DATABASE_URL`
and skips silently when it is unset — that is the one file, and it is why a clean run reports
one skipped file and two skipped tests. Silence has two causes, nothing was wrong and nothing was
checked, and they read identically.

## Worktrees

This checkout is **shared** and another agent may switch its branch under you mid-session. The
first command of any session is:

```
git -C /Users/phill-mac/CCW-CRM worktree list
```

Work in a dedicated worktree created **outside** the repository, on persistent storage. **Never
under `/tmp`** — it is swept, and worktrees and review evidence were lost that way on 2026-08-07.
(An earlier draft put a "2.5G" figure on that loss. No measurement supporting it exists, so the
number is gone; the rule does not need it.)

## Credentials

**Never invent, generate, retrieve, or set a secret**, and never work around a missing one. If a
change needs a credential, stop and record the blocker.

This rule is written out here rather than vendored as a skill: the estate-level
`credential-custody` skill cites another project's incidents, secret names and file paths, which
do not belong in a product repository.

## Claims and evidence

This repository has shipped false metrics before — "823 tests", "99.92% uptime", "97%
production-ready" — none of which survived measurement. So:

- **A claim is not an observation.** Before writing "done", "green", "fixed" or "verified", point
  at the command output that proves it. If something is unverified, say so.
- **A null result is not evidence until you have proven the check can return non-null.** Run a
  positive control first. Zero findings from a broken query looks exactly like zero findings from
  a clean system.
- **A prior document's figure is evidence of a prior measurement, not of current state.** Dated
  status documents in `docs/` go stale; re-measure rather than quoting them.
- `.lighthouseci/` is gitignored (`.gitignore:234`), so a path into it is unreadable by anyone but
  you. Cite **uploaded** LHCI report URLs, never local artifacts.

## Agents

**Two** paths under `.claude/` are tracked, because `~/.claude` does not exist on a CI runner:

- `.claude/agents/` — this project's own agent definitions. `scripts/ci/validate-agents.js` reads
  them, and it **fails** if the directory is missing or empty, so deleting or re-ignoring them
  breaks the build rather than silently disabling the check.
- `.claude/settings.json` — project settings.

Everything else under `.claude/` stays ignored, including `worktrees/`, `skills/` and
`settings.local.json`. Confirm with `git check-ignore -v <path>` rather than assuming.
