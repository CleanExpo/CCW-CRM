# CCW Online — Production Operations Runbook

**Version**: 1.0
**Last updated**: 2026-03-30
**Prepared by**: Unite Group Development
**For**: CCW Equipment Suppliers

---

## System Overview

| Component   | Platform   | URL                               | Status    |
| ----------- | ---------- | --------------------------------- | --------- |
| Frontend    | Vercel     | https://ccwonline.com.au          | ✅ Live   |
| Backend API | Railway    | https://[railway-url].railway.app | ✅ Live   |
| Database    | Supabase   | ap-southeast-2 region             | ✅ Live   |
| Auth        | Custom JWT | via backend                       | ✅ Active |

---

## Environment Variables Checklist

### Vercel (Frontend)

| Variable                        | Required            | Set? |
| ------------------------------- | ------------------- | ---- |
| `NEXT_PUBLIC_BACKEND_URL`       | Yes                 | ✅   |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes                 | ✅   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes                 | ✅   |
| `CRON_SECRET`                   | Yes                 | ✅   |
| `ANTHROPIC_API_KEY`             | For AI Boardroom    | ✅   |
| `PERPLEXITY_API_KEY`            | For Boardroom Intel | ✅   |
| `ELEVENLABS_API_KEY`            | For Boardroom Video | ✅   |
| `LINEAR_API_KEY`                | For Boardroom Tasks | ✅   |

### Railway (Backend)

| Variable                | Required     | Set?                 |
| ----------------------- | ------------ | -------------------- |
| `DATABASE_URL`          | Yes          | ✅                   |
| `SECRET_KEY`            | Yes          | ✅                   |
| `JWT_SECRET`            | Yes          | ✅                   |
| `CIN7_API_KEY`          | For Cin7     | ✅                   |
| `STRIPE_SECRET_KEY`     | For Stripe   | ✅                   |
| `STRIPE_WEBHOOK_SECRET` | For Webhooks | ✅                   |
| `XERO_CLIENT_ID`        | For Xero     | ⚠️ CCW action needed |
| `XERO_CLIENT_SECRET`    | For Xero     | ⚠️ CCW action needed |
| `SENDGRID_API_KEY`      | For Email    | ⚠️ Optional          |

---

## Cron Job Inventory

| Schedule     | Path                               | Purpose                        |
| ------------ | ---------------------------------- | ------------------------------ |
| Every 5 min  | `/api/cron/health-check`           | System health monitoring       |
| Every 5 min  | `/api/cron/retry-failed-webhooks`  | Webhook retry queue            |
| Every 15 min | `/api/cron/check-sla-breaches`     | SLA breach detection           |
| Hourly       | `/api/cron/run-autonomous-ops`     | AI autonomous operations       |
| Daily 9am    | `/api/cron/daily-report`           | KPI metrics refresh            |
| Daily 9am    | `/api/cron/check-expiring-quotes`  | Quote expiry alerts            |
| Daily 7pm    | `/api/cron/shadow-sync-cin7`       | Cin7 inventory sync            |
| Daily 9pm    | `/api/cron/auto-reorder-inventory` | Auto purchase order generation |
| 4x daily     | `/api/boardroom/cron`              | AI Boardroom sessions          |

---

## Common Operations

### Check System Health

1. Visit `https://ccwonline.com.au/api/health` — should return `{"status": "healthy"}`
2. Visit Railway dashboard → check backend pod is running
3. Visit Supabase dashboard → check database connections

### Trigger Manual Sync

1. Log in to CCW Online
2. Go to **Dashboard** → find the **Sync Status** widget
3. Click **Trigger Sync** next to Cin7 or Xero
4. Wait 30-60 seconds for the sync to complete

### View Logs

- **Frontend errors**: Vercel Dashboard → Logs tab
- **Backend errors**: Railway → Service → Logs (filter by error level)
- **Database**: Supabase → Logs → Postgres

### Restart Services

- **Frontend**: Vercel redeploys automatically on push to main
- **Backend**: Railway → Service → Restart (takes ~30 seconds)

---

## Rollback Procedure

### Frontend Rollback

1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click **...** → **Redeploy**
4. Confirm — takes 2-3 minutes

### Backend Rollback

1. Go to Railway → Service → Deployments
2. Find the last working deployment
3. Click **Rollback** — takes ~1 minute

---

## Troubleshooting Guide

| Issue                 | Where to Check                | Resolution                         |
| --------------------- | ----------------------------- | ---------------------------------- |
| Page won't load       | Vercel Logs                   | Check for 500 errors, redeploy     |
| Data not syncing      | Dashboard sync widget         | Trigger manual sync, check API key |
| Login fails           | Browser console, Railway Logs | Clear cookies, verify credentials  |
| POS error             | Railway Logs                  | Check backend health endpoint      |
| Xero not connecting   | Railway Logs (`xero`)         | Run through xero-setup-guide.md    |
| Boardroom not running | Vercel Logs (`boardroom`)     | Check ANTHROPIC_API_KEY is set     |
| Invoices missing      | Dashboard, Cin7 sync logs     | Trigger shadow-sync-cin7 cron      |

---

## Staff Onboarding

### Day 1

- [ ] Create user account (ask admin or Unite Group)
- [ ] Log in at ccwonline.com.au with provided credentials
- [ ] Review the CCW Product Report (docs/CCW-Product-Report.pdf)
- [ ] Complete your role-specific training (see Training Guide in Product Report)

### Admin Setup Checklist

- [ ] Create staff accounts via Settings → Users
- [ ] Set up Cin7 API connection (Settings → Integrations → Cin7)
- [ ] Set up Xero connection (see xero-setup-guide.md)
- [ ] Configure POS terminals (Settings → POS)
- [ ] Test a sample order end-to-end

---

## Emergency Contacts

| Role                    | Contact               |
| ----------------------- | --------------------- |
| Unite Group Development | [contact via project] |
| Supabase Support        | support.supabase.com  |
| Railway Support         | railway.app/help      |
| Vercel Support          | vercel.com/support    |
