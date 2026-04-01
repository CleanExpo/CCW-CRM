# CHROME-LINEAR-TRIAGE SKILL

**Skill Name**: chrome-linear-triage
**Version**: 1.0.0
**Trigger**: `/chrome-linear`, "triage linear in browser", "open linear", "check linear board"
**Description**: Open Linear in Chrome, screenshot current board state, triage issues, and update statuses without leaving the browser.

---

## SKILL PURPOSE

Navigate to the Linear workspace in Chrome, capture the board, triage backlog issues visually, and mark issues Done/In Progress directly through the browser when the Linear MCP is unavailable or when visual confirmation is needed.

---

## WHEN TO USE THIS SKILL

- Linear MCP is not responding or rate-limited
- User wants a visual screenshot of the board state
- Bulk-triaging issues and marking them done in one browser session
- Verifying that MCP updates actually appeared in the UI

**Trigger phrases:**
- "open linear in browser"
- "screenshot my linear board"
- "triage linear visually"
- `/chrome-linear`

---

## EXECUTION PROTOCOL

### Step 1: Open Linear

```
mcp__Claude_in_Chrome__navigate: https://linear.app
```

Take a screenshot to confirm login state:
```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

If redirected to login page → stop and tell user they need to be logged into Linear in Chrome.

### Step 2: Navigate to the CCW Team Board

```
mcp__Claude_in_Chrome__get_page_text
```

Find the CCW / Unite workspace and navigate to the active cycle or backlog view.

```
mcp__Claude_in_Chrome__find: { selector: "[data-testid='sidebar-team']" }
```

Take a full-page screenshot of the current board state.

### Step 3: Capture Issue List

```
mcp__Claude_in_Chrome__get_page_text
```

Extract all visible issues: ID, title, status, assignee, priority.
Present a structured table to the user:

```
| ID       | Title                          | Status    | Priority |
|----------|-------------------------------|-----------|----------|
| UNI-XXXX | ...                           | Backlog   | High     |
```

### Step 4: Triage Actions (per user instruction)

For each issue to update:
1. Click the issue row to open it
2. Find the status selector
3. Click to change status (Backlog → In Progress → Done)
4. Screenshot confirmation
5. Navigate back to board

```
mcp__Claude_in_Chrome__computer: { action: "click", coordinate: [x, y] }
```

### Step 5: Final Board Screenshot

After all updates:
```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

Report: issues triaged, final states, any failures.

---

## USER INTERACTION PATTERN

**User:** "Open linear and show me what's in backlog"

**Response:**
```
Opening Linear in Chrome...
[screenshot of board]

Current Backlog (7 issues):
| ID       | Title                        | Priority |
|----------|------------------------------|----------|
| UNI-1751 | Upload YouTube demo videos   | High     |
| UNI-1752 | ElevenLabs audio regen       | Medium   |
...

Which would you like to update?
```

---

## VERIFICATION

After any status change, confirm:
- Issue shows correct status colour in the board column
- The status label text matches the intended state
- Board column count updated correctly

---

## BLOCKERS

- **Not logged in**: Cannot proceed. User must log in to Linear in Chrome first.
- **CAPTCHA / SSO**: Tell user to complete login manually, then retry skill.
- **Stale session**: Navigate to `https://linear.app` fresh and retry.

---

**Version**: 1.0
**Created**: April 2026
**Tools**: `mcp__Claude_in_Chrome__*`
