# CCW-CRM Add-on Spec: NSW Feasibility + AI Phone Sales Agent

**Date:** 16 June 2026  
**Business:** Carpet Cleaners Warehouse  
**Owner audience:** Toby  
**Repo:** `CleanExpo/CCW-CRM`  
**Implementation branch:** `feature/ccw-feasibility-ai-phone-agent-20260616`  
**Codex/build access mode:** `[read:write]`

---

## 1. Toby's Question

> What are we trying to achieve?

## 2. Direct Answer

> **Increase profitable customer access and sales conversion while protecting the Seven Hills cost advantage.**

This feature is not only a property review. It is a live operating model for deciding whether CCW should keep Seven Hills, introduce regional parcel collection, trial an Artarmon micro-showroom, and add an ElevenLabs/Twilio AI phone agent before committing to more rent, stock or staff.

---

## 3. Business Outcomes

The add-on must help CCW:

1. Maintain a living feasibility statement inside CCW-CRM.
2. Compare Seven Hills, Artarmon, hybrid and parcel collection scenarios.
3. Use postcode, margin, pickup, delivery and service-job data to test whether Artarmon is justified.
4. Map competitor and carpet-cleaner hotspot signals in Sydney/NSW.
5. Pilot parcel collection points for eligible non-DG, non-bulky products.
6. Launch an ElevenLabs AI phone agent through Twilio for after-hours and overflow calls.
7. Convert calls into CRM leads, service requests, quote opportunities and human follow-up tasks.
8. Ground AI answers in approved CCW evidence: product catalogue, SDS, manuals, FAQs, service rules and parcel-collection rules.
9. Keep privacy, recording, outbound-call and marketing risk controlled.

---

## 4. Strategic Position

### Current baseline

| Item | Supplied amount |
| --- | ---: |
| Seven Hills rent | AUD 60,000 p.a. |
| One staff member | approx. AUD 105,000 p.a. |
| Known base total | approx. AUD 165,000 p.a. |

### Recommended direction

1. Keep Seven Hills as the NSW service/operational base until data proves a stronger model.
2. Add parcel collection for eligible products rather than duplicating stock everywhere.
3. Add the AI phone agent first, because it can improve access and sales conversion without a major property commitment.
4. Evaluate Artarmon as a micro-showroom/service-intake site only if incremental contribution margin is proven.

---

## 5. Scope

### Included

- Feasibility statement module.
- Scenario comparison dashboard.
- NSW/Sydney map points for branches, competitors, carpet-cleaner hotspots and parcel-collection candidates.
- Parcel collection candidate register and eligibility rules.
- AI phone call-session capture.
- ElevenLabs/Twilio webhook contracts.
- CRM lead and service-request generation from phone-agent outcomes.
- Admin settings for feature flags, pilot mode, call recording, outbound calling and handoff thresholds.

### Excluded for MVP

- Automated lease signing or property acquisition.
- Unapproved dangerous-goods collection flows.
- Fully autonomous outbound sales calls.
- Call recording by default.
- AI advice not grounded in approved CCW source material.

---

## 6. Feature Flags

```env
FEATURE_CCW_FEASIBILITY_AI_PHONE_AGENT=true
FEATURE_CCW_FEASIBILITY_DASHBOARD=true
FEATURE_CCW_PARCEL_COLLECTION_SCENARIOS=true
FEATURE_CCW_AI_PHONE_AGENT=true
FEATURE_CCW_AI_PHONE_AGENT_AFTER_HOURS=true
FEATURE_CCW_AI_PHONE_AGENT_OUTBOUND=false
FEATURE_CCW_AI_PHONE_RECORDING=false
```

Default deployment posture: **after-hours / overflow pilot only**.

---

## 7. Feasibility Data Model

### Core entities

- `ccw_addon_feature_registry`
- `ccw_feasibility_statements`
- `ccw_feasibility_scenarios`
- `ccw_market_map_points`
- `ccw_parcel_collection_locations`
- `ccw_ai_phone_agents`
- `ccw_ai_phone_call_sessions`
- `ccw_ai_phone_leads`
- `ccw_ai_phone_service_requests`

### Scenario fields

Each scenario should support:

- Annual rent.
- Annual staff cost.
- Outgoings.
- Fit-out cost.
- Relocation cost.
- Expected incremental margin.
- Risk score.
- Strategic score.
- Cost score.
- Recommendation.
- Assumptions JSON.

### First scenarios

1. `seven_hills_optimised` — keep Seven Hills and improve service/stock process.
2. `artarmon_micro_showroom` — small showroom/service intake, low stock.
3. `seven_hills_parcel_collection` — Seven Hills base plus regional collection.
4. `hybrid_ai_phone_agent` — Seven Hills plus parcel collection plus AI call capture.

---

## 8. Parcel Collection Rules

### Allowed in MVP

- Small parts.
- Accessories.
- Tools.
- Non-DG consumables.
- Low-risk repeat-order items under carrier size/weight limits.

### Blocked in MVP

- Truckmounts and large machines.
- Bulky equipment.
- Dangerous goods unless explicit compliant partner handling exists.
- Large drums or items above carrier limits.
- Anything requiring technical handover.

### Pilot locations

1. Newcastle.
2. Wollongong.
3. Canberra.
4. Coffs Harbour.
5. Orange.
6. Tamworth.
7. Townsville.
8. Gladstone.

Townsville and Gladstone should be modelled as Brisbane-supported, not Sydney-supported.

---

## 9. AI Phone Agent Design

### Agent purpose

The AI phone agent should answer calls, supply evidence-backed information, reduce missed enquiries, qualify sales/service intent and create CRM records for human follow-up.

### Provider pattern

- Telephony: Twilio.
- Voice agent: ElevenLabs Conversational AI.
- Knowledge grounding: ElevenLabs knowledge base/RAG using approved CCW sources.
- CRM integration: CCW-CRM API tool endpoints.

### Agent modes

1. `after_hours` — default pilot mode.
2. `overflow` — when staff are unavailable.
3. `service_intake` — capture machine/service details.
4. `sales_qualification` — identify product category, urgency, branch and next action.

### First message

> Thanks for calling Carpet Cleaners Warehouse. I can help with product information, machine servicing, order pickup options and getting the right person to call you back. If this is urgent or you need a staff member, I can take the details and escalate it.

### Mandatory behaviour

The agent must:

- Identify that it is an AI phone assistant.
- Avoid pretending to be Toby or a CCW staff member.
- Use only approved knowledge sources.
- Say when it is unsure.
- Offer human handoff for pricing, complaints, machine installs, dangerous goods, warranty disputes and complex service issues.
- Capture lead/contact details only when needed for follow-up.
- Respect privacy and consent rules.

---

## 10. API Contracts

### Feature status

`GET /api/addons/ccw-feasibility-ai/status`

Returns feature flags, configured provider status and pilot-readiness checks.

### Feasibility statements

- `GET /api/feasibility/statements`
- `POST /api/feasibility/statements`
- `GET /api/feasibility/statements/:id`
- `PUT /api/feasibility/statements/:id`

### Scenario comparison

- `GET /api/feasibility/scenarios`
- `POST /api/feasibility/scenarios`
- `POST /api/feasibility/scenarios/:id/calculate`

### Map points

- `GET /api/feasibility/map-points`
- `POST /api/feasibility/map-points`

### Parcel locations

- `GET /api/parcel-collection/locations`
- `POST /api/parcel-collection/locations`
- `POST /api/parcel-collection/eligibility-check`

### Phone agent

- `GET /api/phone-agent/config`
- `PUT /api/phone-agent/config`
- `POST /api/webhooks/twilio/voice/status`
- `POST /api/webhooks/elevenlabs/post-call`
- `GET /api/phone-agent/customer-context`
- `POST /api/phone-agent/leads`
- `POST /api/phone-agent/service-requests`

---

## 11. Security and Compliance

### Defaults

- Call recording disabled.
- Outbound AI calling disabled.
- After-hours/overflow only.
- Webhooks require signature verification.
- Secrets are environment variables only.
- Personal information is minimised and stored only for CRM follow-up.

### Required secrets

```env
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
PHONE_AGENT_WEBHOOK_SECRET=
```

### Australia-specific controls

- Privacy notice must be available before production use.
- Consent language required before recording.
- Marketing SMS/email follow-up must honour consent and unsubscribe rules.
- Human escalation required for complaints, warranty disputes, dangerous goods and pricing exceptions.

---

## 12. MVP Implementation Plan

### Phase 1 — Foundation

- Add database migration and Prisma models or compatible data-access layer.
- Seed baseline Seven Hills, Artarmon, parcel-location and competitor/hotspot records.
- Add feature flag/env validation.
- Add admin-only feature-status endpoint.

### Phase 2 — Feasibility dashboard

- Build statement and scenario CRUD.
- Add scenario calculation service.
- Add map-point API and UI layer.
- Add CSV/import pathway for postcode, margin, pickup and service-job data.

### Phase 3 — AI phone pilot

- Add Twilio webhook signature verification.
- Add ElevenLabs post-call ingestion endpoint.
- Add customer-context lookup by caller phone number.
- Add lead/service-request creation tools.
- Add call-session list/detail admin screen.

### Phase 4 — Pilot controls

- Add pilot dashboard.
- Add handoff rules.
- Add knowledge-source checklist.
- Add QA review fields and call outcome reporting.

---

## 13. Acceptance Criteria

- The repo contains this spec, implementation manifest, Codex task and starter migration.
- Feature flags default to safe pilot mode.
- Tests cover scenario scoring and webhook validation.
- No secrets are committed.
- Locked files are not modified.
- The phone agent cannot create outbound campaigns or recordings unless explicit flags are enabled.
- Leads and service requests created by the agent are traceable back to call session ID.
- Toby can open the feasibility module and clearly see the business goal: profitable access and conversion while protecting Seven Hills cost advantage.

---

## 14. Locked Files

Do not modify these project-locked files during the first implementation pass:

- `apps/backend/src/db/demo_models.py`
- `apps/web/middleware.ts`
- `apps/backend/src/api/routes/demo_auth.py`

---

## 15. Codex Build Setting

```yaml
codex_access_mode: read:write
repository_permission: read:write
branch: feature/ccw-feasibility-ai-phone-agent-20260616
base_branch: main
```

Codex should begin with the migration, typed API contracts and tests before UI expansion.
