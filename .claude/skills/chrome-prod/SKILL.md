# CHROME-PRODUCTION-VERIFY SKILL

**Skill Name**: chrome-production-verify
**Version**: 1.0.0
**Trigger**: `/chrome-prod`, "verify production", "smoke test", "check the live site"
**Description**: Full browser smoke test of the CCW production site — login, dashboard, key modules, video banners — with screenshots at each step.

---

## SKILL PURPOSE

Run a visual smoke test of `ccw-crm-web.vercel.app` after every deployment. Confirm login works, key modules render, the DemoVideoBanner shows correct YouTube thumbnails, and no console errors appear.

---

## WHEN TO USE THIS SKILL

- After any Vercel deployment completes
- Before releasing a new feature to users
- When a user reports something broken on the live site
- Scheduled production health check

**Trigger phrases:**

- "check the production site"
- "run the smoke test"
- "verify live site after deploy"
- `/chrome-prod`

---

## EXECUTION PROTOCOL

### Step 1: Open Production Site

```
mcp__Claude_in_Chrome__navigate: https://ccw-crm-web.vercel.app
```

Screenshot homepage/login:

```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

Check:

- Page loads (no 500/404)
- Login form is visible
- No "Application Error" overlays

### Step 2: Login

```
mcp__Claude_in_Chrome__form_input: { selector: "[name='email']", text: "[test account email]" }
```

**Stop here** — do not type the password. Tell the user:
"Login form is ready. Please type your password and click Sign In."

Wait for user to confirm they've logged in, then take a screenshot.

Alternatively, if user provides a demo/test account with no sensitive data, proceed with the full login flow.

### Step 3: Dashboard Check

After login, screenshot the dashboard:

```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

Verify:

- Dashboard renders (not a blank page)
- Navigation sidebar is visible
- No error toasts or red banners

Read page text for any error messages:

```
mcp__Claude_in_Chrome__get_page_text
```

### Step 4: DemoVideoBanner Check

Find the video banner component on the dashboard:

```
mcp__Claude_in_Chrome__find: { selector: "[data-testid='demo-video-banner'], .demo-video-banner, [class*='video-banner']" }
```

Screenshot the banner area:

```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

Verify:

- Banner renders (not a blank grey box)
- Video thumbnails or play buttons visible
- No broken image icons
- Channel ID `UChN8nQFig73BoefyMBIsN-w` is producing valid thumbnails

### Step 5: Key Module Navigation

Navigate to each core module and screenshot:

1. **Customers** — `https://ccw-crm-web.vercel.app/customers`
2. **Quotes** — `https://ccw-crm-web.vercel.app/quotes`
3. **Orders** — `https://ccw-crm-web.vercel.app/orders`
4. **Products** — `https://ccw-crm-web.vercel.app/products`

For each:

```
mcp__Claude_in_Chrome__navigate: [module-url]
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
mcp__Claude_in_Chrome__get_page_text
```

Check:

- Module title in header
- Data table renders (even if empty)
- No unhandled error messages

### Step 6: Console Error Check

Read browser console for JavaScript errors:

```
mcp__Claude_in_Chrome__read_console_messages
```

Flag any ERROR-level messages. Warnings are acceptable unless they reference `supabase` auth or `RLS`.

### Step 7: Summary Report

Produce a report:

```
## Production Smoke Test — [date/time]
**URL**: https://ccw-crm-web.vercel.app

| Check                    | Status | Notes                      |
|--------------------------|--------|----------------------------|
| Homepage loads           | PASS   |                            |
| Login form renders       | PASS   |                            |
| Dashboard renders        | PASS   |                            |
| DemoVideoBanner visible  | PASS   | Channel ID correct         |
| Customers module         | PASS   |                            |
| Quotes module            | PASS   |                            |
| Orders module            | PASS   |                            |
| Products module          | PASS   |                            |
| Console errors           | PASS   | 0 errors                   |

**Overall: PASS** — Production site healthy.
```

If any check fails, list the specific error and recommended action.

---

## SCHEDULED RUN

This skill can be used by the boardroom CRON to auto-verify after each deployment.
Trigger: after Vercel `deployment.succeeded` webhook or after every git push to main.

---

## VERIFICATION STANDARDS

- PASS = renders correctly, no error messages
- WARN = minor cosmetic issue, non-blocking
- FAIL = missing data, error toast, crash, blank page, broken images

Any FAIL requires a Linear issue to be created immediately.

---

## BLOCKERS

- **Not logged in**: The dashboard is auth-protected. User must be logged into the production site in Chrome, or provide a demo account.
- **Vercel deployment still processing**: Wait 2 minutes and retry.
- **MFA on production login**: User must complete 2FA manually.

---

**Version**: 1.0
**Created**: April 2026
**Tools**: `mcp__Claude_in_Chrome__*`
**Related skills**: CHROME-VERCEL-MONITOR, CHROME-SUPABASE-INSPECT
