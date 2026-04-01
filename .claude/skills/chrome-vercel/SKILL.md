# CHROME-VERCEL-MONITOR SKILL

**Skill Name**: chrome-vercel-monitor
**Version**: 1.0.0
**Trigger**: `/chrome-vercel`, "check vercel", "vercel deployment", "check build logs"
**Description**: Navigate to the Vercel dashboard in Chrome to monitor deployment status, check build logs, and verify or set environment variables.

---

## SKILL PURPOSE

Provide visual confirmation of CCW production deployment state on Vercel — build logs, deployment status, domain health, and environment variable verification — using Chrome automation when the Vercel CLI or API is unavailable.

---

## WHEN TO USE THIS SKILL

- A deploy is in progress and you need live build log output
- Need to confirm a specific env var is set (without revealing value)
- Production site is behaving unexpectedly and you want to check the active deployment
- Setting a new environment variable (e.g. `YOUTUBE_CHANNEL_ID`)

**Trigger phrases:**
- "check vercel deployment"
- "is the latest deploy green?"
- "open vercel build logs"
- `/chrome-vercel`

---

## EXECUTION PROTOCOL

### Step 1: Open Vercel Dashboard

```
mcp__Claude_in_Chrome__navigate: https://vercel.com/dashboard
```

Screenshot to confirm login:
```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

If not logged in → stop. Tell user to log into Vercel in Chrome.

### Step 2: Navigate to CCW Project

Look for the `ccw-crm-web` project in the dashboard.

```
mcp__Claude_in_Chrome__find: { selector: "[href*='ccw-crm-web']" }
mcp__Claude_in_Chrome__computer: { action: "click", coordinate: [x, y] }
```

### Step 3: Check Deployment Status

On the project page:
```
mcp__Claude_in_Chrome__get_page_text
```

Extract:
- Latest deployment status (Ready / Building / Error)
- Commit hash and message that triggered it
- Deployment URL
- Build time

Screenshot the deployments list.

### Step 4: Check Build Logs (if Building or Error)

Click the latest deployment → "Build Logs":
```
mcp__Claude_in_Chrome__computer: { action: "click", coordinate: [x, y] }
mcp__Claude_in_Chrome__get_page_text
```

Extract error lines (lines containing "Error", "Failed", "Cannot find").
Report them to the user.

### Step 5: Check Environment Variables (read-only)

Navigate to Settings → Environment Variables:
```
mcp__Claude_in_Chrome__navigate: [project-url]/settings/environment-variables
mcp__Claude_in_Chrome__get_page_text
```

List env var NAMES (never values) that are configured. Confirm presence of:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `YOUTUBE_CHANNEL_ID`
- `ANTHROPIC_API_KEY`

Report which are present/missing.

### Step 6: Set Environment Variable (requires explicit user confirmation)

If user asks to add/update an env var, **pause and confirm before typing**:

"Ready to set `[KEY_NAME]` on Vercel production. Please confirm and provide the value."

After user confirms:
1. Click "Add New" or edit existing
2. Type key name
3. User must type value themselves (sensitive data — do not type secrets)

---

## VERIFICATION

After deployment:
- Status badge shows "Ready" (green)
- Domain resolves: screenshot `https://ccw-crm-web.vercel.app`
- No error toasts on the production site

---

## BLOCKERS

- **Not logged in**: Stop. User must log in to Vercel in Chrome.
- **Build actively running**: Poll every 30 seconds with screenshots until complete.
- **Env var values**: NEVER read or display env var values — only presence/key names.

---

**Version**: 1.0
**Created**: April 2026
**Tools**: `mcp__Claude_in_Chrome__*`
