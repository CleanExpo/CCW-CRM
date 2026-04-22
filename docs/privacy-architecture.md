# Privacy Architecture — AU Privacy Act 2024 Compliance

**Status**: Implementation Required
**Deadline**: July 2026 (small business exemption removed)
**Prepared**: 2026-03-30

---

## Overview

The AU Privacy Act 2024 amendments create binding obligations for CCW:

| Deadline      | Obligation                                                        |
| ------------- | ----------------------------------------------------------------- |
| **July 2026** | Small business exemption removed — CCW becomes a regulated entity |
| **Ongoing**   | Notifiable Data Breach (NDB) scheme applies                       |
| **Ongoing**   | Privacy Policy must be publicly available and accurate            |

---

## Required Implementations

### 1. Consent Banner (July 2026)

**What**: A cookie/data consent banner that appears on first visit to ccwonline.com.au and ccwonline.com.au/portal.

**Required fields**:

- What data is collected (cookies, usage analytics, name/email)
- Why it's collected (order processing, account management)
- Who it's shared with (Supabase, Cin7, Xero, Stripe)
- How to opt out

**File to create**: `apps/web/components/privacy/ConsentBanner.tsx`

**Implementation approach**:

```tsx
// Store consent in localStorage + cookie
// Show on first visit (no consent cookie)
// "Accept All" → set consent=all cookie (30 days)
// "Essential Only" → set consent=essential cookie (30 days)
// Link to Privacy Policy page
```

### 2. AI Transparency Notice (July 2026)

**What**: A clear notice that the CCW Boardroom AI system processes business data.

**Locations to add**:

- Settings → Integrations page
- Boardroom session output pages
- First login after AI features enabled

**Content**:

> "CCW Online uses AI models (Anthropic Claude) to generate strategic recommendations in the AI Boardroom feature. Your business data (revenue trends, customer counts, inventory levels) is sent to Anthropic's API for processing. Data is not used for model training. See our Privacy Policy for details."

**File to create**: `apps/web/components/privacy/AITransparencyNotice.tsx`

### 3. Privacy Policy Page (July 2026)

**What**: A publicly accessible Privacy Policy at `/privacy` detailing:

- Data controller: CCW Equipment Suppliers (ABN required)
- Data collected: account info, transaction data, device info
- Data processors: Supabase, Anthropic, Stripe, Cin7, Xero
- Retention: active accounts + 7 years (ATO requirement for financial records)
- Rights: access, correction, deletion requests (email: privacy@ccwequipment.com.au)
- Breach notification: within 30 days per NDB scheme

**Implemented route**: `src/app/(marketing-pages)/privacy/page.tsx` (see `PrivacyPublicPage` component).

### 4. Data Retention Policy (Ongoing)

| Data Type                    | Retention Period               | Reason           |
| ---------------------------- | ------------------------------ | ---------------- |
| Transaction records          | 7 years                        | ATO requirement  |
| Customer records             | 3 years after last transaction | Privacy Act      |
| AI Boardroom session records | 1 year                         | Business records |
| Auth logs                    | 90 days                        | Security audit   |
| Webhook logs                 | 30 days                        | Debugging        |

**Implementation**: Supabase scheduled functions or Vercel cron to delete expired records.

### 5. Notifiable Data Breach (NDB) Response Plan

If a data breach occurs:

1. **Contain**: Disable affected accounts, rotate credentials
2. **Assess**: What data was exposed? How many individuals?
3. **Notify OAIC**: Within 30 days if "likely to cause serious harm"
4. **Notify affected individuals**: If required by OAIC
5. **Document**: Keep breach record for 5 years

**Contact**: OAIC Notifiable Data Breach form at oaic.gov.au/privacy/notifiable-data-breaches

---

## Implementation Roadmap

| Phase   | Items                                                  | Timeline   |
| ------- | ------------------------------------------------------ | ---------- |
| Phase 1 | Privacy Policy page + AI Transparency Notice           | April 2026 |
| Phase 2 | Consent banner + localStorage consent storage          | May 2026   |
| Phase 3 | Data retention cron jobs + breach response runbook     | June 2026  |
| Phase 4 | Full Privacy Act audit + OAIC registration if required | July 2026  |

---

## Current Status

- [x] Privacy Policy page at `/privacy` (draft content — legal review still required)
- [ ] Consent banner on first visit
- [ ] AI Transparency Notice in Settings
- [ ] Data retention automation
- [ ] NDB response runbook
- [ ] Legal review of Privacy Policy content

**Note**: Legal review of the Privacy Policy text is required before go-live. Unite Group can build the technical implementation but the legal wording should be reviewed by a privacy lawyer or the OAIC's online guidance tool.
