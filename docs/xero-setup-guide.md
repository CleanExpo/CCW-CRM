# Xero OAuth Setup Guide for CCW

This guide walks through connecting the CCW ERP/CRM to Xero so that invoices,
payments, and contacts sync automatically each night.

---

## Prerequisites

- A Xero account with accounting access for CCW
- Access to the Railway backend environment variables (Phill)
- The production backend URL (Railway) — e.g. `https://ccw-backend.up.railway.app`

---

## Step 1 — Create a Xero Developer App

1. Go to **[developer.xero.com](https://developer.xero.com)**
2. Sign in with your Xero credentials
3. Click **My Apps** → **New App**
4. Fill in the form:
   - **App name**: `CCW ERP Integration`
   - **Company URL**: `https://ccwonline.com.au`
   - **OAuth 2.0 redirect URI**:
     ```
     https://<your-railway-backend-url>/api/integrations/xero/callback
     ```
     Example: `https://ccw-backend.up.railway.app/api/integrations/xero/callback`
   - **Scopes** (select all that apply):
     - `accounting.transactions`
     - `accounting.contacts`
     - `accounting.settings.read`
5. Click **Create App**

---

## Step 2 — Copy Your App Credentials

From the Xero Developer Portal, on your new app's page:

1. Copy the **Client ID**
2. Generate and copy the **Client Secret** (click "Generate a secret")

Keep these — you need them in the next step.

---

## Step 3 — Add Environment Variables to Railway

In the [Railway dashboard](https://railway.app):

1. Open your **CCW backend** service
2. Go to **Variables**
3. Add the following environment variables:

| Variable | Value |
|---|---|
| `XERO_MODE` | `live` |
| `XERO_CLIENT_ID` | *(Client ID from Step 2)* |
| `XERO_CLIENT_SECRET` | *(Client Secret from Step 2)* |
| `XERO_REDIRECT_URI` | `https://<your-railway-backend-url>/api/integrations/xero/callback` |
| `XERO_SCOPES` | `accounting.transactions accounting.contacts accounting.settings.read` |

4. Railway will automatically redeploy with the new variables

---

## Step 4 — Connect Xero in the Dashboard

1. Open the CCW ERP at **[ccwonline.com.au](https://ccwonline.com.au)**
2. Go to **Settings → Integrations**
3. Find the **Xero** card
4. Click **Connect Xero**
5. You will be redirected to Xero to authorise access
6. After authorising, you'll be returned to the dashboard
7. The Xero card should now show **Connected**

---

## Step 5 — Verify the Connection

After connecting:

1. Check the Xero card shows your **organisation name** and **Connected** status
2. Wait for the first nightly sync (8pm AEST) or manually trigger:
   ```
   GET https://<backend-url>/api/cron/shadow-sync-xero
   ```
3. Check the dashboard for imported invoices and contacts

---

## Step 6 — Re-enable the Xero Cron Jobs

The Xero cron jobs were disabled in `apps/web/vercel.json` to prevent failed
invocations before credentials were configured. Once connected:

1. Open `apps/web/vercel.json`
2. Uncomment (or re-add) the two Xero cron entries:
   ```json
   { "path": "/api/cron/refresh-xero-tokens", "schedule": "*/15 * * * *" },
   { "path": "/api/cron/shadow-sync-xero", "schedule": "0 20 * * *" }
   ```
3. Commit and push — Vercel will pick up the cron changes on next deploy

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Demo Mode Active" toast on connect | `XERO_MODE` is not set to `live` | Set `XERO_MODE=live` in Railway |
| Redirect goes to localhost | `XERO_REDIRECT_URI` still has localhost value | Update to Railway URL in Railway env vars |
| "Invalid client" error from Xero | Wrong Client ID or Secret | Re-check values from developer.xero.com |
| Callback returns 404 | Backend not deployed with new env vars | Redeploy Railway service |
| Token refresh fails | `XERO_CLIENT_SECRET` mismatch | Regenerate secret on Xero developer portal |

---

## Environment Variable Summary

```bash
# Railway backend environment variables required for live Xero

XERO_MODE=live
XERO_CLIENT_ID=your_client_id_here
XERO_CLIENT_SECRET=your_client_secret_here
XERO_REDIRECT_URI=https://your-railway-backend.up.railway.app/api/integrations/xero/callback
XERO_SCOPES=accounting.transactions accounting.contacts accounting.settings.read
```

---

*Last updated: 2026-03-30*
