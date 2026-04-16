# CHROME-SUPABASE-INSPECT SKILL

**Skill Name**: chrome-supabase-inspect
**Version**: 1.0.0
**Trigger**: `/chrome-supabase`, "open supabase dashboard", "check supabase rls", "supabase browser"
**Description**: Navigate Supabase dashboard in Chrome to inspect RLS status, run SQL queries in the editor, check auth hooks, and review security advisors.

---

## SKILL PURPOSE

Provide visual access to the Supabase dashboard for tasks that require the UI — activating the JWT hook, reviewing security advisors, checking table-level RLS, and running ad-hoc SQL — when the Supabase MCP is unavailable or when UI confirmation is needed.

---

## WHEN TO USE THIS SKILL

- Activating the Supabase JWT authentication hook (manual UI action)
- Visually confirming RLS is enabled on all tables
- Running SQL in the Supabase SQL editor
- Checking Database Advisors (security and performance)
- Reviewing auth logs or edge function logs

**Trigger phrases:**

- "open supabase dashboard"
- "activate the jwt hook in supabase"
- "check rls status in browser"
- `/chrome-supabase`

---

## EXECUTION PROTOCOL

### Step 1: Open Supabase

```
mcp__Claude_in_Chrome__navigate: https://supabase.com/dashboard
```

Screenshot to confirm login:

```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

If not logged in → stop. Tell user to log in to Supabase in Chrome.

### Step 2: Navigate to CCW Project

Find the CCW project in the project list. Look for project named "ccw" or matching the project URL.

```
mcp__Claude_in_Chrome__get_page_text
mcp__Claude_in_Chrome__find: { selector: "[href*='project']" }
```

Click through to the project dashboard.

### Step 3: RLS Status Check

Navigate to Table Editor or Database → Tables:

```
mcp__Claude_in_Chrome__navigate: [project-url]/editor
```

Then to Database → Tables (for RLS column):

```
mcp__Claude_in_Chrome__get_page_text
```

Extract each table name and RLS enabled status. Report:

```
| Table             | RLS Enabled |
|-------------------|-------------|
| customers         | YES         |
| quotes            | YES         |
| ...               | ...         |
```

Tables WITHOUT RLS should be flagged as HIGH PRIORITY.

### Step 4: JWT Hook Activation (manual assist)

Navigate to Authentication → Hooks:

```
mcp__Claude_in_Chrome__navigate: [project-url]/auth/hooks
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

Read the page to find the JWT Claims Customization hook:

```
mcp__Claude_in_Chrome__get_page_text
```

Show the user the current hook state. If the hook exists but is disabled:

- Highlight where the toggle is
- Ask user: "The JWT hook is visible but disabled. Should I click Enable?"
- Only click after explicit user confirmation

### Step 5: SQL Editor

Navigate to SQL Editor for ad-hoc queries:

```
mcp__Claude_in_Chrome__navigate: [project-url]/sql/new
```

Type the query in the editor:

```
mcp__Claude_in_Chrome__form_input: { selector: ".monaco-editor", text: "[SQL query]" }
```

Run and extract results:

```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
mcp__Claude_in_Chrome__get_page_text
```

### Step 6: Security Advisors

Navigate to Database → Advisors → Security:

```
mcp__Claude_in_Chrome__navigate: [project-url]/database/advisors
mcp__Claude_in_Chrome__get_page_text
```

List all security findings. For each:

- Severity (ERROR / WARN / INFO)
- Description
- Affected table/function

---

## VERIFICATION

After any change:

- Screenshot the affected page
- Read page text to confirm the setting changed
- Report exact before/after state

---

## CRITICAL RULES

- NEVER read or screenshot connection strings, JWT secrets, API keys, or service role keys
- NEVER navigate to Settings → API (keys are displayed there)
- The JWT hook toggle requires explicit user confirmation before clicking
- Only report table/column NAMES — never row data unless user requests a specific query

---

## BLOCKERS

- **Not logged in**: Stop. User must log in to Supabase in Chrome.
- **MFA required**: Stop. User must complete MFA manually.
- **JWT hook not visible**: The hook may need to be created first — guide user to do this manually.

---

**Version**: 1.0
**Created**: April 2026
**Tools**: `mcp__Claude_in_Chrome__*`
