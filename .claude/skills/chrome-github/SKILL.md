# CHROME-GITHUB-PR SKILL

**Skill Name**: chrome-github-pr
**Version**: 1.0.0
**Trigger**: `/chrome-github`, "open github pr", "review pr in browser", "check github actions"
**Description**: Navigate GitHub in Chrome to create PRs, review diffs, check Actions CI status, and merge branches when the `gh` CLI is unavailable or when visual diff review is needed.

---

## SKILL PURPOSE

Provide browser-based GitHub workflow automation for the CCW-CRM repository — PR creation, CI monitoring, diff review, and merging — as an alternative or supplement to `gh` CLI commands.

---

## WHEN TO USE THIS SKILL

- Reviewing a visual diff of a large PR
- Checking GitHub Actions run status and logs
- Creating a PR with a complex description
- Merging after CI passes
- Investigating a failing workflow step

**Trigger phrases:**
- "open the PR on github"
- "check if CI passed"
- "create a github PR in browser"
- `/chrome-github`

---

## EXECUTION PROTOCOL

### Step 1: Open Repository

```
mcp__Claude_in_Chrome__navigate: https://github.com/[owner]/CCW-CRM
```

Screenshot to confirm repo and login:
```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

If not logged in or wrong repo → stop and correct.

### Step 2: Check PR Status

Navigate to Pull Requests tab:
```
mcp__Claude_in_Chrome__navigate: https://github.com/[owner]/CCW-CRM/pulls
mcp__Claude_in_Chrome__get_page_text
```

List open PRs:
```
| PR #  | Title                        | Author  | CI Status | Reviews |
|-------|------------------------------|---------|-----------|---------|
| #123  | feat: add video pipeline     | user    | PASSING   | 0       |
```

### Step 3: Check Actions CI

Navigate to a specific workflow run:
```
mcp__Claude_in_Chrome__navigate: https://github.com/[owner]/CCW-CRM/actions
mcp__Claude_in_Chrome__get_page_text
```

Find the latest run for the current branch. Extract:
- Status (queued / in progress / success / failure)
- Failing step name and error message
- Duration

If failing, click through to the specific job → step → copy error lines.

### Step 4: Create Pull Request

**Requires user confirmation before submission.**

Navigate to compare page:
```
mcp__Claude_in_Chrome__navigate: https://github.com/[owner]/CCW-CRM/compare/[branch]
```

Fill in PR details:
```
mcp__Claude_in_Chrome__form_input: { selector: "#pull_request_title", text: "[title]" }
mcp__Claude_in_Chrome__form_input: { selector: "#pull_request_body", text: "[description]" }
```

PR description template:
```
## Summary
- [bullet point changes]

## Test plan
- [ ] TypeScript: `pnpm run type-check` passes
- [ ] Tests: `pnpm run test` passes
- [ ] Visual: production site checked

🤖 Generated with Claude Code
```

Pause before clicking "Create pull request":
"Ready to create the PR. Review the title and description above, then confirm."

After user confirms:
```
mcp__Claude_in_Chrome__computer: { action: "click", coordinate: [submit-button] }
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

Report: PR number and URL.

### Step 5: Review Diff

Navigate to Files Changed tab:
```
mcp__Claude_in_Chrome__computer: { action: "click", coordinate: [files-changed-tab] }
mcp__Claude_in_Chrome__get_page_text
```

Summarise:
- Files changed (count)
- Lines added / removed
- Any files that look risky (migrations, middleware, auth routes)

### Step 6: Merge PR

**Requires explicit user confirmation.**

"Ready to merge PR #[N] via [merge strategy]. This cannot be undone. Confirm?"

After confirmation:
1. Click "Merge pull request"
2. Confirm merge dialog
3. Screenshot merged state

```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

---

## VERIFICATION

After PR creation:
- PR URL is valid and accessible
- CI checks appear (may take 30–60 seconds to start)
- Assignees/reviewers set if required

After merge:
- Branch deleted (if auto-delete enabled)
- Deployment triggered on Vercel (check with CHROME-VERCEL-MONITOR skill)

---

## BLOCKERS

- **Not logged in**: Stop. User must log in to GitHub in Chrome.
- **Branch protection**: Cannot bypass required reviews — notify user.
- **Merge conflicts**: Report conflict files, suggest resolving locally first.

---

**Version**: 1.0
**Created**: April 2026
**Tools**: `mcp__Claude_in_Chrome__*`
