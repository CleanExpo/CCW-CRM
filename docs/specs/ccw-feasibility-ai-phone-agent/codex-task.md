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

The first implementation must also absorb the Senior Project Method inclusions pulled from `CleanExpo/Fabel-Prompt-Engineer`: recreate-able schema, durable read path, Evidence Standard findings, refinement lineage, export, and parser tests.

## Known Repo Observations

- This repo uses Next.js route handlers under `src/app/api/**/route.ts`.
- The data layer is Prisma with committed migrations under `prisma/migrations/`.
- Existing authenticated APIs use `requireAuthScope(request)` and workspace member scoping.
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
- include indexes and foreign keys for statement/scenario lineage, findings, call sessions, and CRM traceability;
- seed only safe baseline/candidate records using repo conventions.

Done when a fresh empty database can run the migrations and reproduce every add-on table, column, index, and relationship the app uses.

### 2. P0 - Build The Read Path

Implement authenticated list/detail APIs and minimal UI for:

- feasibility statements;
- scenarios;
- evidence findings/assumptions;
- refinement/version chain;
- phone-agent call sessions.

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

Ensure CI runs `npm run test` alongside lint/type-check/build if it does not already.

Done when a parser break fails `npm run test` and CI would block the PR.

### 7. Feasibility Engine

Create a small domain service that calculates:

- total annual cost;
- estimated first-year cost;
- required extra monthly contribution;
- weighted feasibility score;
- recommendation: `keep`, `pilot`, `defer`, or `reject`.

Minimum tests:

1. Seven Hills baseline remains attractive under low rent.
2. Artarmon requires incremental contribution before recommendation improves.
3. Parcel collection hybrid can be recommended when low cost and high strategic score.

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
- AI-created CRM records must link back to `callSessionId`;
- escalate pricing exceptions, complaints, warranty, dangerous goods, and complex service questions.

### 10. UI MVP

Build only after data/API basics work:

- objective card with Toby's answer;
- saved statement list/detail;
- scenario comparison table;
- evidence findings/assumption register;
- refinement lineage;
- parcel candidate and eligibility view;
- phone-agent pilot status;
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
- `GET /api/feasibility/findings`
- `GET /api/feasibility/map-points`
- `GET /api/parcel-collection/locations`
- `POST /api/parcel-collection/eligibility-check`
- `GET /api/phone-agent/config`
- `PUT /api/phone-agent/config`
- `GET /api/phone-agent/call-sessions`
- `GET /api/phone-agent/call-sessions/[id]`
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
- Evidence findings are created and visible.
- `[UNCONFIRMED]` assumptions are surfaced.
- Refinement lineage is visible.
- Markdown export works.
- Scenario scoring tests pass.
- Parser tests pass.
- Parcel blocklist tests pass.
- Webhook invalid-signature/secret tests pass.
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
