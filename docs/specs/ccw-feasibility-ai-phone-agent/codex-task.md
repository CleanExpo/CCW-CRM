# Codex Task - Implement CCW NSW Feasibility + AI Phone Agent Add-on

**Access mode:** `[read:write]`
**Repo:** `CleanExpo/CCW-CRM`
**Branch:** `feature/ccw-feasibility-ai-phone-agent-20260616`
**Linear:** `UNI-2140`
**Source spec:** `docs/specs/ccw-feasibility-ai-phone-agent/spec.md`
**Planning stub:** `docs/specs/ccw-feasibility-ai-phone-agent/migration_stub.sql`

## Product Goal

Build the CCW-CRM add-on that answers Toby's question:

> What are we trying to achieve?

Product answer:

> Increase profitable customer access and sales conversion while protecting the Seven Hills cost advantage.

The feasibility statement must behave like Toby's ongoing AI ally: constantly looking for growth, diversification, and cost-saving opportunities, measuring them over time, and preparing decision material without committing owner-level decisions.

Financial claims must be owner-adjustable and accounting-aware. Toby can edit planning inputs such as rent, staff cost, revenue, margin, and expected savings; the system should show whether each value is owner-entered, Toby-adjusted, Xero-backed, stale, or disputed.

The ElevenLabs/Twilio work must be implemented alongside the new CRM as the modern phone gatekeeper: answer routine calls when CCW already has approved knowledge, create traceable CRM drafts when useful, and escalate cleanly when a human is truly required.

The phone system must also learn from past conversations. It should discover intents, personas, objections, answer gaps, conversion patterns, service/training demand, and campaign ideas; then generate specialised agent/playbook drafts that improve user experience, lead capture, sales conversion, phone orders, service bookings, hands-on support bookings, CARSI/in-house/online training, newsletters, email campaigns, and social media blitzes.

Follow-up agents must monitor CRM/order/service/event signals and fire approved follow-up emails/messages or draft campaigns for tracking updates, service intervals, quote/order follow-up, company days, mini-tradeshows, appreciation days, industry awards, supplier showcases, training days, newsletters, email campaigns, and social media blitzes.

The first implementation must also absorb the Senior Project Method inclusions pulled from `CleanExpo/Fabel-Prompt-Engineer`: recreate-able schema, durable read path, Evidence Standard findings, refinement lineage, export, and parser tests.

## Known Repo Observations

- This repo uses Next.js route handlers under `src/app/api/**/route.ts`.
- The data layer is Prisma with committed migrations under `prisma/migrations/`.
- Existing authenticated APIs use `requireAuthScope(request)` and workspace member scoping.
- Xero integration already exists under `src/lib/integrations/xero*`, `src/app/api/integrations/xero/**`, and `src/lib/api/xero.ts`; reuse those patterns for accounting-backed claim state.
- Vitest is already available through `npm run test`.
- The migration stub in this spec folder is not the final migration. Convert it into real Prisma models and a real migration.

## Locked/Unrelated Files

Do not modify unrelated local files or historical locked paths. In this repo pass, keep changes scoped to Prisma schema/migrations, add-on domain services, add-on API routes, focused UI, tests, and the docs in this spec folder.

## Build Order

### 0. Confirm Architecture

Inspect before editing:

- `package.json`
- `prisma/schema.prisma`
- `src/app/api/customers/route.ts`
- `src/lib/auth/data-scope.ts`
- `src/lib/auth/workspace-scope.ts`
- `src/lib/db/prisma.ts`
- existing Vitest tests under `src/**/*.test.ts` and `src/**/__tests__/*.test.ts`

Record any deviations in the PR body.

### 1. P0 - Schema Into The Repo

Create committed schema source of truth:

- add Prisma models for the add-on;
- add a real migration under `prisma/migrations/<timestamp>_ccw_feasibility_ai_phone_agent/migration.sql`;
- include owner/workspace scoping consistent with existing CRM records;
- include indexes and foreign keys for statement/scenario lineage, financial claims, financial claim evidence, Xero backing references, growth opportunities, opportunity measurements, findings, knowledge sources, call sessions, phone triage decisions, conversation insights, specialised agents, agent learnings, generated actions, follow-up agents, follow-up rules/actions/templates, industry events, invites, awards, and CRM traceability;
- seed only safe baseline/candidate records using repo conventions.

Done when a fresh empty database can run the migrations and reproduce every add-on table, column, index, and relationship the app uses.

### 2. P0 - Build The Read Path

Implement authenticated list/detail APIs and minimal UI for:

- feasibility statements;
- scenarios;
- financial claims and Xero backing status;
- growth/diversification/cost-saving opportunities;
- opportunity measurements;
- evidence findings/assumptions;
- refinement/version chain;
- approved phone knowledge sources;
- phone-agent call sessions.
- conversation insights, specialised agent drafts, agent learning history, and generated action drafts.
- follow-up agents, follow-up rules/actions/templates, industry events, invites, RSVPs, awards, and event follow-up outcomes.

Done when a user can save a statement/scenario, refresh the page, reopen it from a list, and verify it came from the database.

### 3. P1 - Wire Up The Evidence Standard

Implement a parser/service equivalent to the Fabel evidence ledger:

- extract `[VERIFIED]`, `[INFERENCE]`, and `[UNCONFIRMED]` claims from generated/refined statements;
- store findings with tag, claim, source URL/path if present, and statement/scenario IDs;
- surface findings and assumption register in the UI.

Done when generating/refining a statement produces visible findings and `[UNCONFIRMED]` assumptions are readable.

### 4. P1 - Add Refinement Lineage

When a statement or scenario is refined/re-run:

- create a new version;
- set `parentStatementId` or `parentScenarioId`;
- show the version chain in the UI.

Done when a re-run spec clearly shows which version it descended from after refresh.

### 5. P1 - Export

Add an export action for finished feasibility statements:

- Markdown is required first;
- PDF is optional only after Markdown works;
- include evidence tags and a findings summary in the export.

Done when clicking export downloads a `.md` file locally.

### 6. P1 - Tests And CI Coverage

Add meaningful Vitest coverage for:

- evidence/tagged-claim parser;
- board/critique finding parser if implemented;
- scenario scoring;
- parcel eligibility/blocklist;
- Twilio invalid-signature rejection;
- ElevenLabs invalid-secret rejection;
- refinement lineage service.
- conversation insight extraction;
- specialised agent version approval gates;
- generated action routing for lead, sale, order, booking, training, and campaign drafts.
- follow-up rule gating, consent/frequency caps, template approval, and send audit;
- industry event invite, RSVP, awards, and post-event follow-up workflows.

Ensure CI runs `npm run test` alongside lint/type-check/build if it does not already.

Done when a parser break fails `npm run test` and CI would block the PR.

### 7. Feasibility Engine

Create a small domain service that calculates:

- total annual cost;
- estimated first-year cost;
- required extra monthly contribution;
- weighted feasibility score;
- recommendation: `keep`, `pilot`, `defer`, or `reject`.

Financial claim requirements:

- store each claim with value, currency, period, source type, evidence state, Toby override notes, and optional Xero source reference;
- support evidence states: `owner_entered`, `toby_adjusted`, `xero_backed`, `stale`, and `disputed`;
- reconcile claim values from Xero where an account/contact/tracking/report mapping is available;
- never overwrite Toby-adjusted values silently; store proposed Xero value and require accepted/disputed state.

Also create the opportunity engine for Toby's AI ally:

- classify opportunities as `growth`, `diversification`, `cost_saving`, or `risk_reduction`;
- store expected value, effort, risk, evidence basis, source records, status, owner decision needed, and next review date;
- record measured outcomes so recommendations can be compared against actual results;
- keep every opportunity as advisory until Toby or an approved human commits it.

Minimum tests:

1. Seven Hills baseline remains attractive under low rent.
2. Toby-adjusted financial values override defaults without losing audit history.
3. Xero-backed financial claims expose source reference, sync time, and accepted/disputed state.
4. Artarmon requires incremental contribution before recommendation improves.
5. Parcel collection hybrid can be recommended when low cost and high strategic score.
6. Opportunity ranking prioritises high-value, low-risk growth/cost-saving records with evidence over unsupported ideas.

### 8. Parcel Collection

Implement:

- candidate location register;
- eligibility check API;
- default blocklist for dangerous goods, bulky machines, large drums, carrier-limit breaches, and technical-handover items;
- override audit shape if overrides are allowed later.

Do not promise collection availability for blocked items by default.

### 9. ElevenLabs/Twilio Phone-Agent Pilot

Implement behind safe flags:

- `GET /api/addons/ccw-feasibility-ai/status`
- `GET /api/phone-agent/config`
- `PUT /api/phone-agent/config`
- `GET /api/phone-agent/knowledge-sources`
- `POST /api/phone-agent/knowledge-sources`
- `GET /api/phone-agent/customer-context`
- `GET /api/phone-agent/call-sessions`
- `GET /api/phone-agent/call-sessions/[id]`
- `POST /api/webhooks/twilio/voice/status`
- `POST /api/webhooks/elevenlabs/post-call`

Security requirements:

- verify Twilio signatures before processing;
- require shared-secret/provider verification for ElevenLabs;
- never log secrets;
- default recording and outbound calling to false;
- ground answers only in approved CCW-owned sources and approved credible external sources;
- store the source basis/confidence for each AI-resolved call where available;
- store a triage outcome for every handled call: `answered_by_ai`, `human_handoff_required`, `follow_up_created`, `lead_created`, `quote_draft_created`, `service_draft_created`, or `blocked_escalated`;
- discover and store call intents, caller personas, objections, answer gaps, escalation reasons, conversion signals, training demand, and campaign opportunities;
- generate specialised agent/playbook drafts for sales qualification, product advice, online sales, phone orders, service bookings, hands-on customer support bookings, training/CARSI enquiries, campaign capture, and escalation triage;
- keep specialised agents versioned, inactive by default, and approval-gated before live use;
- convert call learnings into generated action drafts: lead, online sale nudge, phone order draft, service booking draft, support booking draft, CARSI/training follow-up, newsletter idea, email campaign draft, or social media blitz brief;
- AI-created CRM records must link back to `callSessionId`;
- escalate pricing exceptions, complaints, warranty, dangerous goods, and complex service questions.

### 9A. Follow-Up Agents And Industry Hub

Implement follow-up agents behind safe approval controls:

- monitor tracking/status changes and create customer update actions;
- monitor service intervals and equipment/service history for service reminder actions;
- monitor open quotes, phone-order drafts, online sales intent, dormant accounts, and high-intent enquiries for nurture actions;
- manage company days, mini-tradeshows, appreciation days, supplier showcases, industry awards, and training/event workflows;
- create invite lists, RSVP records, speaker/guest records, award nominations, post-event tasks, and outcome metrics;
- support email/message/newsletter/social campaign drafts and approved sends;
- require consent basis, approved template/version, frequency cap, send state, and audit trail for every outbound follow-up;
- keep follow-ups draft-only until a rule is explicitly approved for auto-send.

### 10. UI MVP

Build only after data/API basics work:

- objective card with Toby's answer;
- saved statement list/detail;
- scenario comparison table;
- AI ally opportunity list for growth, diversification, and cost saving;
- opportunity measurement history;
- evidence findings/assumption register;
- refinement lineage;
- parcel candidate and eligibility view;
- phone-agent pilot status;
- knowledge source approval/status panel;
- phone triage outcome labels;
- conversation insight dashboard;
- specialised agent draft/version review;
- generated action queue for leads, sales, orders, bookings, training, newsletters, email campaigns, and social blitzes;
- follow-up agent control panel;
- follow-up action queue with draft/approved/sent/blocked states;
- company day, mini-tradeshow, appreciation day, industry awards, supplier showcase, and training event management;
- call-session list/detail if ingestion exists;
- Markdown export button.

Avoid paid map integrations or external map keys in the first pass unless the repo already has a map stack.

## Required API Surface

- `GET /api/addons/ccw-feasibility-ai/status`
- `GET /api/feasibility/statements`
- `POST /api/feasibility/statements`
- `GET /api/feasibility/statements/[id]`
- `PUT /api/feasibility/statements/[id]`
- `POST /api/feasibility/statements/[id]/refine`
- `GET /api/feasibility/scenarios`
- `POST /api/feasibility/scenarios`
- `POST /api/feasibility/scenarios/[id]/calculate`
- `GET /api/feasibility/financial-claims`
- `POST /api/feasibility/financial-claims`
- `PUT /api/feasibility/financial-claims/[id]`
- `POST /api/feasibility/financial-claims/[id]/xero-reconcile`
- `GET /api/feasibility/opportunities`
- `POST /api/feasibility/opportunities`
- `POST /api/feasibility/opportunities/[id]/measure`
- `GET /api/feasibility/findings`
- `GET /api/feasibility/map-points`
- `GET /api/parcel-collection/locations`
- `POST /api/parcel-collection/eligibility-check`
- `GET /api/phone-agent/config`
- `PUT /api/phone-agent/config`
- `GET /api/phone-agent/knowledge-sources`
- `POST /api/phone-agent/knowledge-sources`
- `GET /api/phone-agent/call-sessions`
- `GET /api/phone-agent/call-sessions/[id]`
- `GET /api/phone-agent/conversation-insights`
- `POST /api/phone-agent/conversation-insights/discover`
- `GET /api/phone-agent/specialized-agents`
- `POST /api/phone-agent/specialized-agents`
- `POST /api/phone-agent/specialized-agents/[id]/versions`
- `POST /api/phone-agent/specialized-agents/[id]/approve`
- `GET /api/phone-agent/generated-actions`
- `POST /api/phone-agent/generated-actions/[id]/approve`
- `GET /api/follow-up-agents`
- `POST /api/follow-up-agents`
- `POST /api/follow-up-agents/[id]/rules`
- `POST /api/follow-up-actions/[id]/approve`
- `POST /api/follow-up-actions/[id]/send`
- `GET /api/industry-events`
- `POST /api/industry-events`
- `GET /api/industry-events/[id]/invites`
- `POST /api/industry-events/[id]/invites`
- `POST /api/industry-events/[id]/awards`
- `GET /api/phone-agent/customer-context`
- `POST /api/webhooks/twilio/voice/status`
- `POST /api/webhooks/elevenlabs/post-call`

## Safe Defaults

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

## Verification Commands

Run as implementation reaches each layer:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

For schema work, also verify a fresh database migration replay using the repo's Prisma migration workflow before marking Phase 1 complete.

## Acceptance Criteria

- Real Prisma migration and models exist for every add-on table the app uses.
- Save/refresh/reopen works for feasibility statements and scenarios.
- Toby can adjust financial claims and see whether each value is owner-entered, adjusted, Xero-backed, stale, or disputed.
- Xero-backed claim tests cover source reference and accepted/disputed state.
- Growth, diversification, and cost-saving opportunities can be generated, ranked, measured, and reopened.
- Evidence findings are created and visible.
- `[UNCONFIRMED]` assumptions are surfaced.
- Refinement lineage is visible.
- Markdown export works.
- Scenario scoring tests pass.
- Parser tests pass.
- Parcel blocklist tests pass.
- Webhook invalid-signature/secret tests pass.
- Phone triage outcomes are stored for handled calls.
- AI-resolved phone calls are grounded in approved knowledge sources or escalated.
- Conversation insight extraction produces intents, personas, objections, answer gaps, and conversion opportunities.
- Specialised agents/playbooks are generated as inactive draft versions and require approval before activation.
- Generated action drafts cover leads, online sales nudges, phone orders, service bookings, support bookings, CARSI/training follow-ups, newsletters, email campaigns, and social media blitz briefs.
- Follow-up agents can produce approved/draft tracking updates, service interval reminders, quote/order follow-ups, company-day invites, event follow-ups, appreciation-day outreach, awards outreach, newsletters, messages, email campaigns, and social blitz briefs.
- Company days, mini-tradeshows, appreciation days, industry awards, supplier showcases, and training days have event records, invites, RSVPs, follow-up plans, and outcome metrics.
- Auto-send follow-up rules require approved template/version, consent basis, frequency cap, audit log, and owner approval.
- Phone-agent-created records reference a call session ID.
- Recording and outbound calling remain disabled by default.
- `npm run lint`, `npm run type-check`, `npm run test`, and `npm run build` pass before PR is marked ready.

## Suggested First Commit

Implement only:

1. Prisma schema/migration;
2. evidence parser and tests;
3. scenario scoring service and tests;
4. feature-status endpoint.

Then verify before moving to read-path UI and webhooks.
