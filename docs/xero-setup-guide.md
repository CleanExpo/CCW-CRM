# Xero OAuth Setup Guide — CCW Equipment Suppliers

**Last updated**: 2026-03-30
**Status**: Ready for CCW to complete

---

## Overview

The Xero integration is fully coded and tested. The only blocker is CCW registering a Xero Developer App and providing the credentials. This guide walks through every step.

**Time required**: ~20 minutes

---

## Step 1: Create a Xero Developer Account

1. Go to [developer.xero.com](https://developer.xero.com)
2. Sign in with your Xero account (same as your accounting login)
3. Click **My Apps** → **New App**

---

## Step 2: Register the CCW App

Fill in the form:

| Field | Value |
|---|---|
| **App name** | CCW Online ERP |
| **Company or application URL** | https://ccwonline.com.au |
| **OAuth 2.0 redirect URI** | https://ccwonline.com.au/api/integrations/xero/callback |
| **Scopes** | `accounting.transactions`, `accounting.contacts`, `accounting.settings`, `offline_access` |

Click **Create App**.

---

## Step 3: Get Your Credentials

After creating the app:
1. Click the app name to open settings
2. Copy the **Client ID**
3. Click **Generate a secret** and copy the **Client Secret** (you only see this once)

---

## Step 4: Add Environment Variables to Railway

1. Go to [railway.app](https://railway.app) → CCW backend service → **Variables**
2. Add these variables:

| Variable | Value |
|---|---|
| `XERO_CLIENT_ID` | (from Step 3) |
| `XERO_CLIENT_SECRET` | (from Step 3) |
| `XERO_REDIRECT_URI` | `https://ccwonline.com.au/api/integrations/xero/callback` |

3. Click **Deploy** to restart the backend with the new variables.

---

## Step 5: Authorise the Connection in CCW

1. Log in to [ccwonline.com.au](https://ccwonline.com.au)
2. Go to **Settings → Integrations → Xero**
3. Click **Connect Xero**
4. You'll be redirected to Xero's login page — sign in with your Xero account
5. Click **Allow Access** on the permissions screen
6. You'll be redirected back to CCW with a "Xero connected" confirmation

---

## Step 6: Verify the Connection

After connecting:
- Dashboard sync widget should show **Xero: Connected**
- Go to **Invoices** — you should see Xero sync status
- The nightly sync will run at 8pm AEST and import invoices/payments

---

## Troubleshooting

| Issue | Solution |
|---|---|
| "Invalid redirect URI" error | Verify the redirect URI in your Xero app matches exactly: `https://ccwonline.com.au/api/integrations/xero/callback` |
| "Client not found" error | Double-check the Client ID was copied correctly (no spaces) |
| Sync not working after connect | Check Railway logs for `xero_sync` errors, verify scopes include `accounting.transactions` |
| Token expired | Re-connect via Settings → Integrations → Xero → Disconnect → Reconnect |

---

## Support

If you encounter issues, contact Unite Group Development with:
1. Screenshot of the error message
2. The Railway backend logs (Railway → Logs tab, filter by "xero")
3. Your Xero app Client ID (NOT the secret)
