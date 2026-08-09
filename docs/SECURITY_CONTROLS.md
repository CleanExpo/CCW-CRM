# Optix Security Controls

**Audience:** Toby Bredhauer / CCW  
**Last updated:** 2026-08-07  
**Scope:** The three baseline controls from the Internal Engineering Checklist

---

## 1. Stripe webhooks as source of truth for card payments

| Item                     | Status                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Signed webhook endpoint  | Implemented — `POST /api/webhooks/stripe`                                                                                                |
| Signature verification   | `Stripe.webhooks.constructEvent` + `STRIPE_WEBHOOK_SECRET`                                                                               |
| Card → Paid path         | Only after verified Stripe event (`payment_intent.succeeded`, `checkout.session.completed`, optional `invoice.paid` with Optix metadata) |
| Manual UI card mark-paid | Blocked — CRM + fulfilment APIs reject `credit_card` / `card` / `stripe`                                                                 |
| Offline payments         | Cash / EFT / cheque / bank_transfer still allowed with reference + `created_by_user_id` audit fields                                     |

**Ops setup**

1. Stripe Dashboard → Developers → Webhooks → Add endpoint  
   `https://<production-host>/api/webhooks/stripe`
2. Subscribe: `payment_intent.succeeded`, `checkout.session.completed`, `invoice.paid`
3. Set Railway/Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
4. When creating Checkout / PaymentIntent, set metadata:
   - CRM invoice: `invoice_id=<Invoice.id>`
   - Fulfilment sales invoice: `sales_invoice_id=<SalesInvoice.id>`

**Evidence:** Send Stripe “Send test webhook” after wiring; Optix logs `Stripe webhook processed` with event id (no card PAN logged).

---

## 2. Multi-factor authentication (MFA) for internal users

| Item           | Status                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| Method         | TOTP authenticator app (`otpauth`)                                                          |
| Recovery codes | 10 one-time codes, stored hashed (SHA-256)                                                  |
| Secret storage | AES-256-GCM encrypted (`MFA_ENCRYPTION_KEY` or derived from `JWT_SECRET`)                   |
| Enforcement    | Default **on** for every Optix `AppUser` (`MFA_ENFORCE=false` to disable in local/dev only) |
| Login flow     | Password → MFA challenge (or forced enrollment) → session cookies/JWT                       |

**APIs**

- `POST /api/auth/mfa/setup`
- `POST /api/auth/mfa/confirm`
- `POST /api/auth/mfa/verify`
- `GET /api/auth/mfa/status`
- Settings → Account → Enable 2FA

**Evidence:** Privileged/internal account cannot obtain an access token without TOTP (or recovery code) when enforcement is on.

---

## 3. Encrypted backups (AU)

| Control                  | How Optix meets it                                                             |
| ------------------------ | ------------------------------------------------------------------------------ |
| At rest (app backups)    | GPG AES-256 on full + incremental + WAL dumps (`scripts/backup-database.sh`)   |
| At rest (object storage) | S3 SSE-AES256 on upload; bucket in `ap-southeast-2`                            |
| At rest (primary DB)     | Supabase Postgres disk encryption (platform) — project region `ap-southeast-2` |
| In transit               | TLS to Supabase; HTTPS AWS CLI to S3                                           |
| Retention                | Full 30 days / incremental 7 days (script + document S3 lifecycle)             |
| Region                   | Default `AWS_DEFAULT_REGION=ap-southeast-2`; Vercel `syd1`                     |

**Runbook**

```bash
# Configure config/.backup.env with BACKUP_ENCRYPTION_KEY, DB_*, S3_BUCKET
./scripts/backup-database.sh full
./scripts/restore-backup.sh <path-or-s3-uri>   # staging DB only for tests
./scripts/verify-backup.sh
```

**Restore test evidence:** record results in `docs/evidence/RESTORE-TEST-YYYY-MM-DD.md` after the first staging restore (date, operator, checksum, pass/fail).

---

## Environment variables

| Variable                | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Stripe API                                         |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature (`whsec_…`)                      |
| `MFA_ENCRYPTION_KEY`    | Preferred key for TOTP secret encryption           |
| `MFA_ENFORCE`           | Default on; set `false` only for local/dev         |
| `MFA_ISSUER`            | Authenticator label (default `Optix / CCW Online`) |
| `BACKUP_ENCRYPTION_KEY` | GPG passphrase for database dumps                  |
| `AWS_DEFAULT_REGION`    | Must be `ap-southeast-2` for AU backups            |
| `S3_BUCKET`             | e.g. `s3://ccw-online-erp-backups-ap-southeast-2`  |

---

## Migration

Apply Prisma migration:

`prisma/migrations/20260807120000_security_controls_mfa_stripe_audit`

Adds MFA columns / recovery codes table and payment audit fields (`source`, `stripe_event_id`, `created_by_user_id`).
