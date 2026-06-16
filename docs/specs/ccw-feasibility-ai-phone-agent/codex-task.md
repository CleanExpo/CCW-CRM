# Codex Task — Build CCW NSW Feasibility + AI Phone Agent Add-on

**Access mode:** `[read:write]`  
**Repo:** `CleanExpo/CCW-CRM`  
**Branch:** `feature/ccw-feasibility-ai-phone-agent-20260616`  
**Source spec:** `docs/specs/ccw-feasibility-ai-phone-agent/spec.md`  
**Migration stub:** `docs/specs/ccw-feasibility-ai-phone-agent/migration_stub.sql`

---

## Goal

Build the first implementation pass for the CCW-CRM add-on that helps Carpet Cleaners Warehouse answer Toby's core question:

> What are we trying to achieve?

The product answer is:

> **Increase profitable customer access and sales conversion while protecting the Seven Hills cost advantage.**

---

## Operating Principles

Follow the existing CCW project principles:

1. Think before coding.
2. Keep changes surgical.
3. Avoid speculative abstractions.
4. Add verify steps with each implementation slice.
5. Do not modify locked files.

Locked files for this pass:

- `apps/backend/src/db/demo_models.py`
- `apps/web/middleware.ts`
- `apps/backend/src/api/routes/demo_auth.py`

---

## Build Order

### 1. Inspect existing architecture

Before writing code, inspect:

- `package.json`
- `prisma/schema.prisma`
- existing Next.js API route patterns under `src/app/api/**/route.ts`
- existing auth/data-scope helpers under `src/lib/auth/**`
- existing Prisma client setup under `src/lib/db/**`
- existing webhook verification helpers under `src/lib/integrations/**`
- existing tests using Vitest

Document any assumptions in the PR body or a comment before implementation.

---

### 2. Data layer

Implement the add-on tables using the repo's established migration convention.

Create or adapt models/tables for:

- feature registry/config
- feasibility statements
- feasibility scenarios
- market map points
- parcel collection locations
- AI phone agents/config
- AI call sessions
- AI call events
- AI call transcripts, if safe for MVP
- consent/audit records

Default posture:

- AI phone agent inactive until explicitly configured.
- Call recording disabled.
- Outbound AI calling disabled.
- After-hours / overflow pilot enabled only when feature flag is true.

---

### 3. Scenario scoring service

Create a small domain service that can calculate feasibility scores for scenarios.

Minimum input fields:

- annual rent
- annual staff cost
- annual outgoings
- fit-out cost
- relocation cost
- expected incremental margin
- strategic score
- risk score
- cost score

Minimum output fields:

- total annual cost
- estimated first-year cost
- required extra monthly contribution
- weighted feasibility score
- recommendation: `keep`, `pilot`, `defer`, or `reject`

Add unit tests for at least:

1. Seven Hills baseline remains attractive under low rent.
2. Artarmon requires incremental contribution before recommendation improves.
3. Parcel collection hybrid can be recommended when low cost and high strategic score.

---

### 4. API endpoints

Implement safe, authenticated endpoints matching the spec.

Minimum first-pass endpoints:

- `GET /api/addons/ccw-feasibility-ai/status`
- `GET /api/feasibility/scenarios`
- `POST /api/feasibility/scenarios`
- `POST /api/feasibility/scenarios/[id]/calculate`
- `GET /api/feasibility/map-points`
- `GET /api/parcel-collection/locations`
- `POST /api/parcel-collection/eligibility-check`
- `GET /api/phone-agent/config`
- `PUT /api/phone-agent/config`
- `POST /api/webhooks/twilio/voice/status`
- `POST /api/webhooks/elevenlabs/post-call`
- `GET /api/phone-agent/customer-context`

Use existing auth patterns. Do not expose admin/config endpoints publicly.

---

### 5. Webhook security

Implement webhook verification before any production path is enabled.

Minimum requirements:

- Verify Twilio signature for Twilio webhook endpoints.
- Require a shared secret or provider verification strategy for ElevenLabs post-call ingestion.
- Store raw webhook payloads only as needed for audit/debugging.
- Never log secrets.
- Add tests for invalid signatures.

---

### 6. CRM actions from phone calls

Implement service functions that can:

- lookup customer context by caller phone number
- create a lead from a qualified AI phone call
- create a service-request draft from service intake
- create a human follow-up task/handoff marker

Lead/service records must reference the originating call session ID.

---

### 7. Seed data

Add safe seed data for the pilot:

- Seven Hills baseline
- Artarmon micro-showroom option template
- parcel collection candidates: Newcastle, Wollongong, Canberra, Coffs Harbour, Orange, Tamworth, Townsville, Gladstone
- competitor/map-point starter records
- SWOT categories where suitable

Do not create fake customer/order records unless the repo already has demo seeding conventions and those conventions are followed.

---

### 8. UI MVP

Build only after the data/API layer is stable.

Minimum UI:

- feasibility objective card showing Toby's answer
- scenario comparison table
- parcel collection pilot table
- phone-agent pilot status panel
- call-session list/detail if call-session ingestion exists

Do not add map vendor keys or paid-map integrations in the first pass unless the repo already has a map stack.

---

## Environment Variables

```env
FEATURE_CCW_FEASIBILITY_AI_PHONE_AGENT=true
FEATURE_CCW_FEASIBILITY_DASHBOARD=true
FEATURE_CCW_PARCEL_COLLECTION_SCENARIOS=true
FEATURE_CCW_AI_PHONE_AGENT=true
FEATURE_CCW_AI_PHONE_AGENT_AFTER_HOURS=true
FEATURE_CCW_AI_PHONE_AGENT_OUTBOUND=false
FEATURE_CCW_AI_PHONE_RECORDING=false
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
PHONE_AGENT_WEBHOOK_SECRET=
```

Do not commit real keys.

---

## Acceptance Criteria

- `npm run lint` passes.
- `npm run type-check` passes.
- Tests cover scenario scoring and webhook rejection paths.
- Feature defaults remain safe: no outbound AI calling and no recording.
- All phone-agent-created CRM records are linked back to a call session.
- The status endpoint clearly shows whether the add-on is configured for pilot use.
- PR remains draft until implementation and tests are complete.

---

## Suggested First Commit

Implement only:

1. schema/migration
2. scenario scoring service
3. scenario scoring tests
4. feature-status endpoint

Then run verify before moving to webhooks.
