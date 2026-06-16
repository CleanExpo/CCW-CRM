# Production-Readiness Spec - CCW NSW Feasibility + AI Phone Agent

**Date:** 16 June 2026
**Project:** CCW-CRM
**Business:** Carpet Cleaners Warehouse
**Owner audience:** Toby
**Repo:** `CleanExpo/CCW-CRM`
**Branch:** `feature/ccw-feasibility-ai-phone-agent-20260616`
**Linear:** `UNI-2140`

## Finish Line

This is done when CCW-CRM can recreate the add-on database from committed Prisma migrations, generate and measure a living feasibility statement for Toby, save and reopen statements/scenarios/growth opportunities/call sessions after refresh, surface evidence findings and assumption registers, preserve refinement lineage, export finished specs/statements, and run parser/scoring/webhook tests in CI while the ElevenLabs/Twilio phone agent operates as a safe gatekeeper for the new CRM. [INFERENCE - synthesized from `UNI-2140`, the existing CCW repo, the Fabel Senior Project Method inputs, and user clarification on 16 June 2026]

## Evidence Ledger

- `UNI-2140` defines the product goal as: "Increase profitable customer access and sales conversion while protecting the Seven Hills cost advantage." [VERIFIED - Linear issue `UNI-2140`]
- `UNI-2140` scopes the add-on across feasibility scenarios, parcel collection, ElevenLabs/Twilio phone-agent webhooks, customer lookup, CRM record creation, and human handoff. [VERIFIED - Linear issue `UNI-2140`]
- CCW-CRM is a Next.js app with Prisma migrations, Prisma Client, Vitest, lint, type-check, and build scripts in `package.json`. [VERIFIED - `package.json`, `prisma/schema.prisma`, `prisma/migrations/`]
- Existing authenticated API routes use `requireAuthScope(request)`, workspace member scoping, and `NextResponse.json({ detail })` error shapes. [VERIFIED - `src/app/api/customers/route.ts`, `src/lib/auth/data-scope.ts`, `src/lib/auth/workspace-scope.ts`]
- CCW-CRM already has Xero integration code for OAuth, connection status, token storage/refresh, invoice sync, and Xero API access patterns. [VERIFIED - `src/lib/integrations/xero.ts`, `src/lib/integrations/xero-oauth.ts`, `src/lib/integrations/xero-storage.ts`, `src/lib/integrations/xero-tokens.ts`, `src/app/api/integrations/xero/**`, `src/lib/api/xero.ts`]
- The pulled Fabel method requires an Evidence Standard with `[VERIFIED]`, `[INFERENCE]`, and `[UNCONFIRMED]` claims, a findings ledger, a read path for saved specs, lineage between refinements, export, and parser tests. [VERIFIED - `CleanExpo/Fabel-Prompt-Engineer` files `CLAUDE.md`, `skills/fable-engine/SKILL.md`, `lib/evidence.ts`, `lib/supabase.ts`, `supabase/migrations/0004_spec_lineage.sql`, `tests/parsers.test.ts`]
- Seven Hills rent, staff cost, Artarmon viability, parcel pilot locations, and commercial assumptions are real owner-supplied planning claims that must be editable by Toby and capable of being backed by Xero accounting evidence where Xero contains the relevant records. [VERIFIED - user clarification on 16 June 2026]
- Toby needs the feasibility statement to behave like a constant AI ally looking for growth, diversification, and cost-saving opportunities that improve future decision-making. [VERIFIED - user clarification on 16 June 2026]
- The ElevenLabs/Twilio implementation should be designed alongside the new CRM as a modern phone gatekeeper that decides whether a caller truly needs a human or can be answered from CCW-owned and approved credible knowledge. [VERIFIED - user clarification on 16 June 2026]

## 0. Where This Sits In The Pipeline

CCW-CRM needs a product loop, not a one-off document:

1. **Brainstorm:** capture Toby's strategic question, branch/property assumptions, parcel-collection ideas, and AI-phone pilot concepts.
2. **Spec:** turn those inputs into a grounded feasibility statement with evidence tags, scenario math, gates, and implementation criteria.
3. **Loop:** run board/owner critique, re-run refinements with lineage, compare versions, and promote only approved versions into build work.

The add-on must make this loop visible in the app: list saved statements, reopen a previous version, see its evidence findings, see its parent, export it, review active growth/diversification/cost-saving opportunities, and know which gates remain blocked. [INFERENCE - application of the Fabel read-path, findings, lineage, export, and opportunity-loop method to `UNI-2140`]

## 1. System Observatory

### What It Is

CCW-CRM is an ERP/CRM for Carpet Cleaners Warehouse with customers, contacts, activities, quotes, orders, inventory, workshop/service modules, integrations, dashboards, and operational APIs. [VERIFIED - observed files under `src/app/(dashboard)`, `src/app/api`, `src/lib/api`, `src/lib/db`, and `prisma/schema.prisma`]

This add-on adds a decision and pilot layer for NSW access strategy and Toby's ongoing operating decisions:

- compare Seven Hills, Artarmon, hybrid, and parcel/AI-phone scenarios;
- store the living feasibility statement and scenario assumptions;
- generate and measure growth, diversification, and cost-saving opportunities against actual CRM/ERP signals;
- maintain a decision-assistant backlog of opportunities, risks, required evidence, owner decisions, and expected value;
- test parcel collection rules for eligible products;
- ingest Twilio and ElevenLabs call events;
- use the ElevenLabs/Twilio agent as the CRM phone gatekeeper, separating calls that truly need a human from calls answerable with approved CCW knowledge;
- convert qualified AI-phone outcomes into CRM leads, service-request drafts, quote opportunities, or human follow-up activities;
- keep every consequential action behind a human or hard-rule gate.

### Infrastructure Already In Place

- **Framework/runtime:** Next.js, React, TypeScript. [VERIFIED - `package.json`]
- **Data layer:** Prisma with PostgreSQL migrations under `prisma/migrations`. [VERIFIED - `prisma/schema.prisma`, `prisma/migrations/`]
- **Testing:** Vitest is configured and `npm run test` exists. [VERIFIED - `package.json`]
- **API patterns:** route handlers under `src/app/api/**/route.ts` with auth scopes and workspace scoping. [VERIFIED - `src/app/api/customers/route.ts`, `src/lib/auth/data-scope.ts`]
- **CRM surfaces:** customers, contacts, activities, quotes, orders, products, workshop equipment, service reminders, and integration routes already exist. [VERIFIED - `prisma/schema.prisma`, `src/app/api/**`]

### AI Ally Operating Model

The feasibility statement is not a static report. It is Toby's operating ally inside the CRM:

- **Growth:** identify demand patterns, missed calls, quote gaps, product/category opportunities, regional pickup demand, and service upsell signals.
- **Diversification:** identify adjacent product/service categories, regional partner models, training/content opportunities, and channel expansion ideas.
- **Cost saving:** identify rent, stock, freight, staff-time, missed-call, service-route, and low-margin process waste.
- **Measurement:** every opportunity needs expected value, effort, risk, required evidence, data source, status, next review date, and a plain-English recommendation.
- **Owner control:** the AI may recommend and prepare decision material, but Toby remains the decision maker for commitments, spend, staffing, pricing, and customer-impacting policy.

### Owner-Adjustable Claims And Xero Backing

Financial claims are not hardcoded constants. Each financial input must be stored with value, currency, period, source type, evidence state, Toby override history, and optional Xero backing reference. [INFERENCE - implementation requirement from user clarification and existing Xero integration]

- [VERIFIED] Seven Hills current rent is an owner-supplied business claim that Toby can edit and should be backed by Xero once mapped to the correct account, contact, bill, transaction, or tracking category. [VERIFIED - user clarification on 16 June 2026]
- [VERIFIED] NSW staff cost is an owner-supplied business claim that Toby can edit and should be backed by Xero where payroll, wage, contractor, or related expense records are available to the integration. [VERIFIED - user clarification on 16 June 2026]
- [UNCONFIRMED] The exact Xero account/contact/tracking mapping for Seven Hills rent and NSW staff cost has not been selected yet.
- [UNCONFIRMED] Artarmon demand and incremental contribution margin are decision claims that should remain editable until backed by actual sales, margin, lead, quote, service, or Xero-derived evidence.
- [UNCONFIRMED] Parcel collection partners can handle the proposed item classes, states, opening hours, liability, and customer ID checks.
- [UNCONFIRMED] ElevenLabs and Twilio commercial/pricing terms are acceptable for the pilot.
- [UNCONFIRMED] CCW Shopify, website, catalogue, SDS, manuals, FAQs, supplier guidance, and selected credible external sources can provide enough coverage to answer most routine phone calls without human intervention.
- [UNCONFIRMED] The first measurable opportunity categories should be growth, diversification, and cost saving; Toby may choose more categories later.

## 2. Definition Of Production-Ready & Owned

The add-on is **Production-Ready & Owned** only when:

- all schema, seed data, and relationships are represented in committed Prisma migration files and `prisma/schema.prisma`;
- a fresh empty database can be migrated and used by the app without relying on live-only Supabase/Postgres drift;
- generated or manually authored feasibility statements can be saved, listed, reopened, refined, exported, and audited;
- generated feasibility statements are measured over time through opportunity records, target metrics, actual outcomes, review dates, and status changes;
- Toby can adjust owner-entered financial claims directly in the UI, see when they are owner-entered versus Xero-backed, and preserve an audit trail of changes;
- Xero-backed financial claims store the source account/contact/transaction/report reference, last synced timestamp, and reconciliation status;
- Toby can see a ranked list of growth, diversification, and cost-saving opportunities with evidence, expected value, effort, risk, and next decision required;
- every tagged claim or assumption in a feasibility statement is extracted into a findings/assumption ledger;
- every refinement records its parent, so Toby can see which version descended from which;
- webhooks reject invalid signatures before storing or acting on provider payloads;
- the phone agent records a triage decision for each handled call: answered by AI, human handoff needed, follow-up task created, lead/quote/service draft created, or blocked/escalated;
- the phone agent answers only from approved CCW-owned knowledge and approved credible external sources, and escalates when confidence or permission is insufficient;
- phone-agent-created CRM records reference the originating call session ID;
- feature defaults keep outbound AI calling and call recording disabled;
- all code, config, migrations, tests, and docs live in Phill's/GitHub-owned repo and deployment accounts;
- a new engineer can run the app, migrate a fresh database, execute tests, and understand the gates from docs alone.

## 3. Gap-Discovery Mechanism

Before each implementation phase, run a mechanical gap pass and record results in the PR body or implementation notes.

| Severity | Check | What Fails The Gate |
| --- | --- | --- |
| P0 | Schema replay | Fresh database migration does not recreate every table/column/relation used by the add-on. |
| P0 | Read path | A saved statement, scenario, call session, board response, or finding cannot be listed and reopened after refresh. |
| P0 | Security gate | Twilio/ElevenLabs webhooks can write data without valid signature/shared-secret verification. |
| P0 | Consequential action | AI can enable recording, outbound calls, pricing exceptions, warranty decisions, dangerous goods handling, or lease/property commitments without a human/hard-rule gate. |
| P1 | Opportunity measurement | Growth, diversification, and cost-saving recommendations have no expected value, risk, evidence, review date, or measured outcome. |
| P1 | Xero backing | Financial claims such as rent, staff cost, margin, revenue, or savings cannot be marked owner-entered, Toby-adjusted, Xero-backed, stale, or disputed. |
| P1 | Phone gatekeeping | Calls are logged without a triage decision or the AI cannot explain why it answered versus escalated. |
| P1 | Knowledge grounding | Phone answers are not tied to approved Shopify/website/catalogue/knowledge sources or credible external sources. |
| P1 | Evidence Standard | Tagged claims and `[UNCONFIRMED]` assumptions are not extracted into findings. |
| P1 | Lineage | Refinement creates a disconnected version without `parent_*` linkage. |
| P1 | Export | Finished feasibility statements/specs can only be copied, not downloaded. |
| P1 | Parser coverage | Claim, assumption, board-finding, webhook, and eligibility parsers lack meaningful tests. |
| P2 | UX clarity | Toby cannot see the objective, scenario recommendation, blocked gates, and next human decision from one module. |

Each gap must be given an owner, phase, test gate, and reviewer. If a gap cannot be fixed in the current pass, it remains visible in the open-items section rather than being silently deferred.

## 4. Consequential-Action Gates

Standing rule: the system may prepare consequential actions, but may not commit them until a human or hard rule clears the gate.

| Domain | System May Prepare | It Must Not Commit Without Gate | Gate Owner / Hard Rule |
| --- | --- | --- | --- |
| Property strategy | Compare Seven Hills, Artarmon, hybrid, and parcel models. | Lease, relocation, staffing, fit-out, or stock-transfer decisions. | Toby signs off after scenario has verified cost/margin inputs. |
| Pricing and margin | Calculate required extra monthly contribution and scenario scores. | Discounts, quotes, margin promises, or pricing exceptions. | Human sales/admin approval. |
| Financial claims and Xero backing | Let Toby adjust planning inputs and reconcile them against Xero evidence. | Treat stale, unmapped, or disputed Xero data as final. | Toby approval plus Xero reconciliation state. |
| Growth/diversification/cost opportunities | Rank opportunities, estimate value/effort/risk, and prepare recommendation briefs. | Commit spend, change supplier/channel strategy, launch offers, alter staffing, or promise savings as fact. | Toby approval plus verified or Toby-adjusted supporting data. |
| Parcel collection | Mark eligible candidate items and locations. | Collection promise for DG, bulky machines, large drums, technical handover, or unapproved partner sites. | Hard blocklist plus human override log. |
| AI phone calls | Answer routine questions, qualify intent, capture details, create draft records, and decide whether a human is required. | Pretend to be staff, provide ungrounded advice, resolve complaints/warranty disputes, or answer complex service/install questions as final. | Approved knowledge source, confidence threshold, and escalation rule. |
| Knowledge sourcing | Use CCW Shopify/website/catalogue/SDS/manual/FAQ/service-rule knowledge and approved credible external sources. | Treat unapproved web content as fact or answer from unknown provenance. | Source approval status, evidence tag, and source citation stored. |
| Recording/privacy | Detect whether recording is configured. | Record a call or store transcript by default. | Recording flag enabled, consent captured, retention policy set. |
| Outbound contact | Draft a follow-up task. | Run outbound AI campaigns, SMS/email marketing, or automated callbacks. | Explicit outbound flag, consent/unsubscribe compliance, human approval. |
| CRM writes | Create traceable lead/service-request drafts from a call. | Create untraceable customer-impacting records. | `call_session_id` required on AI-created records. |
| Evidence | Extract claims and assumptions into findings. | Treat `[UNCONFIRMED]` claims as facts or hide them from the owner. | Findings UI shows tag, source, and assumption register. |

## 5. Phases With Completion Criteria

### Phase 0 - Repo Grounding And Branch Hygiene

**Definition of Done:** implementation happens on the Linear branch, current repo conventions are documented, and locked/unrelated files remain untouched.
**Hard Test Gate:** `git status --short` shows only intended add-on files changed; existing untracked local files are not modified.
**Review Gate:** Senior PM gap pass confirms the implementation plan matches observed CCW architecture.

### Phase 1 - Schema As Source Of Truth

**Definition of Done:** replace the planning stub with a real Prisma migration and Prisma models for feature config, feasibility statements, scenarios, map points, parcel locations, phone-agent config, call sessions/events, consent/audit records, evidence findings, and lineage fields.
**Hard Test Gate:** a fresh database can run `npm run db:migrate` and the generated Prisma Client exposes the add-on models.
**Review Gate:** Forge/developer review confirms every app-used table, column, index, and relationship is in committed migration files.

### Phase 2 - Durable Read Path

**Definition of Done:** authenticated APIs and UI allow listing and reopening saved feasibility statements, scenario versions, findings, board responses, and call sessions.
**Hard Test Gate:** save a statement/scenario, refresh, list it, reopen it, and verify the record came from the database, not component state.
**Review Gate:** Grid/ops review confirms Toby can recover prior work without knowing database IDs.

### Phase 3 - Evidence Standard And Findings

**Definition of Done:** a tagged-claim parser extracts `[VERIFIED]`, `[INFERENCE]`, and `[UNCONFIRMED]` claims plus assumptions from generated or refined feasibility statements and stores them in findings.
**Hard Test Gate:** generating a feasibility statement creates visible findings and an assumption register in the UI; parser unit tests cover mixed tags, missing sources, multiline content, and cap limits.
**Review Gate:** Lens/legal-ethics review confirms unverified claims are not displayed as facts.

### Phase 4 - Feasibility Engine

**Definition of Done:** scenario CRUD, financial claim records, Xero backing state, opportunity tracking, and a scoring service calculate total annual cost, first-year cost, required extra monthly contribution, weighted feasibility score, recommendation, opportunity expected value, effort, risk, and next review date.
**Hard Test Gate:** Vitest covers Seven Hills baseline, Toby-adjusted financial inputs, Xero-backed claim state, Artarmon contribution requirement, hybrid parcel/AI-phone scenario recommendation, and opportunity ranking for growth/diversification/cost-saving records.
**Review Gate:** Vex/data review confirms formulas, opportunity assumptions, measured outcomes, Toby overrides, Xero backing status, and data sources are visible, not hidden in prose.

### Phase 5 - Parcel Collection Pilot Rules

**Definition of Done:** candidate locations and eligibility checks are implemented with a default blocklist for dangerous goods, bulky machines, large drums, carrier-limit breaches, and technical handover items.
**Hard Test Gate:** eligibility tests prove blocked product categories cannot be marked eligible by default.
**Review Gate:** Lens review confirms the blocked categories and override audit trail are visible.

### Phase 6 - ElevenLabs/Twilio AI Phone Pilot

**Definition of Done:** Twilio status webhook, ElevenLabs post-call webhook, customer lookup by caller phone, call-session storage, knowledge-source lookup, triage decision logging, lead/quote/service-request draft creation, and human handoff markers are implemented behind safe flags.
**Hard Test Gate:** invalid webhook signatures are rejected; valid calls can create traceable records with `call_session_id`; every handled call stores a triage outcome and knowledge-source basis; outbound calling and recording remain false by default.
**Review Gate:** Atlas/orchestrator review confirms provider state, knowledge-source status, triage rules, flags, and pilot readiness are visible in the status endpoint.

### Phase 7 - Refinement Lineage And Export

**Definition of Done:** each regenerated feasibility statement records its parent, displays the version chain, and can be downloaded as Markdown first, PDF later if practical.
**Hard Test Gate:** re-run a statement, refresh, and see parent/child lineage; click export and receive a `.md` file with evidence tags and findings summary.
**Review Gate:** Senior PM review confirms the version chain is legible enough for handoff to a new engineer or owner.

### Phase 8 - CI Tests And Release Gate

**Definition of Done:** CI runs lint, type-check, build, and unit tests for parsers, scoring, webhook verification, and parcel eligibility.
**Hard Test Gate:** intentionally breaking a parser test fails `npm run test`; CI blocks merge on failing tests.
**Review Gate:** Forge review confirms tests cover meaningful behaviour rather than snapshots of implementation details.

## 6. Review Layer

A phase passes only when:

1. its hard gate passes;
2. no soft reviewer objects;
3. P0/P1 gaps are closed or explicitly carried forward with owner approval.

Soft reviewers:

- **Senior PM:** missing pieces, sequencing, definitions of done, owner clarity.
- **Forge:** code architecture, migrations, tests, implementation fit.
- **Vex:** formulas, evidence, data quality, scenario assumptions.
- **Lens:** privacy, consent, dangerous goods, warranty/complaint, marketing risk.
- **Grid:** operational usability, handoff, repeatability.
- **Atlas:** orchestration, release readiness, gate coherence.

## 7. Final Sign-Off Checklist

This checklist is the only honest basis for any "% complete" claim.

- [ ] Fresh database migration recreates all add-on tables, fields, indexes, and relationships.
- [ ] Saved feasibility statements and scenarios survive refresh and reopen from a list.
- [ ] Toby can adjust financial claims such as rent, staff cost, revenue, margin, and expected savings.
- [ ] Financial claims show source state: owner-entered, Toby-adjusted, Xero-backed, stale, or disputed.
- [ ] Xero-backed values show source references and last synced timestamp.
- [ ] Growth, diversification, and cost-saving opportunities are generated, ranked, measured, and reviewable.
- [ ] Evidence findings are created from tagged claims and visible in the UI.
- [ ] `[UNCONFIRMED]` claims appear in the assumption register.
- [ ] Refinements show parent/child lineage.
- [ ] Finished statements export as Markdown.
- [ ] Scenario scoring tests pass.
- [ ] Parser tests pass.
- [ ] Parcel eligibility blocklist tests pass.
- [ ] Twilio invalid-signature tests pass.
- [ ] ElevenLabs invalid-secret tests pass.
- [ ] AI-created CRM records reference a call session ID.
- [ ] Every AI-handled call records whether it was answered, escalated, blocked, or converted to a draft CRM action.
- [ ] Phone answers cite or link to approved CCW Shopify/website/catalogue/knowledge sources or approved credible external sources.
- [ ] Recording is disabled unless the recording flag, consent copy, and retention policy are approved.
- [ ] Outbound AI calling is disabled unless a separate compliance approval enables it.
- [ ] Toby can see the objective, recommendation, assumptions, blocked gates, and next decision in the UI.
- [ ] `npm run lint`, `npm run type-check`, `npm run test`, and `npm run build` pass.

## 8. Open Items For Phill/Toby To Close

- Confirm which Xero accounts, contacts, tracking categories, bills, invoices, reports, or manual adjustments should back Seven Hills rent, NSW staff cost, revenue, margin, and savings claims.
- Confirm who can edit owner-entered financial claims and who can mark a Xero-backed claim as disputed or accepted.
- Confirm the exact Artarmon cost range, lease constraints, and minimum acceptable payback period.
- Confirm whether the first export format should be Markdown only or Markdown plus PDF.
- Confirm which knowledge sources are approved for the AI phone agent: catalogue, SDS, manuals, FAQs, branch hours, service rules, parcel rules.
- Confirm which Shopify/website content should be treated as authoritative and how often it should be refreshed into the AI knowledge base.
- Confirm which external sites count as trusted credible sources, who approves them, and which topics they are allowed to support.
- Confirm the first KPI set for Toby's AI ally: growth value, cost saved, conversion lift, missed calls recovered, service work captured, or another ranking.
- Confirm the privacy/consent wording before any call recording or transcript storage is enabled.
- Confirm whether AI-created "lead" records should map to existing `customers`/`crm_activities`, a new lead table, or draft quote/service-request workflows.
- Confirm who is allowed to override parcel eligibility for edge cases.

## Implementation Notes

### Required Data Model Additions

Use Prisma naming conventions and workspace/owner scoping already present in the repo. The migration stub in this folder is only a planning aid; production work must create a real `prisma/migrations/<timestamp>_ccw_feasibility_ai_phone_agent/migration.sql` plus matching `prisma/schema.prisma` models.

Required entities:

- `CcwAddonFeatureConfig`
- `CcwFeasibilityStatement`
- `CcwFeasibilityScenario`
- `CcwFinancialClaim`
- `CcwFinancialClaimEvidence`
- `CcwGrowthOpportunity`
- `CcwOpportunityMeasurement`
- `CcwMarketMapPoint`
- `CcwParcelCollectionLocation`
- `CcwAiPhoneAgentConfig`
- `CcwAiKnowledgeSource`
- `CcwAiCallSession`
- `CcwAiCallTriageDecision`
- `CcwAiCallEvent`
- `CcwAiCallTranscript` only if consent/retention gates are implemented
- `CcwAiConsent`
- `CcwEvidenceFinding`

Required lineage fields:

- `CcwFeasibilityStatement.parentStatementId`
- `CcwFeasibilityScenario.parentScenarioId`
- `CcwFinancialClaim.statementId`
- `CcwFinancialClaim.scenarioId`
- `CcwFinancialClaimEvidence.financialClaimId`
- `CcwEvidenceFinding.statementId`
- `CcwEvidenceFinding.scenarioId`
- `CcwGrowthOpportunity.statementId`
- `CcwOpportunityMeasurement.opportunityId`
- `CcwAiCallTriageDecision.callSessionId`
- AI-created CRM draft records must include or be linkable through `callSessionId`.

### Required API Surface

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
- `GET /api/phone-agent/customer-context`
- `POST /api/webhooks/twilio/voice/status`
- `POST /api/webhooks/elevenlabs/post-call`

### Safe Defaults

```env
FEATURE_CCW_FEASIBILITY_AI_PHONE_AGENT=true
FEATURE_CCW_FEASIBILITY_DASHBOARD=true
FEATURE_CCW_PARCEL_COLLECTION_SCENARIOS=true
FEATURE_CCW_AI_PHONE_AGENT=true
FEATURE_CCW_AI_PHONE_AGENT_AFTER_HOURS=true
FEATURE_CCW_AI_PHONE_AGENT_OUTBOUND=false
FEATURE_CCW_AI_PHONE_RECORDING=false
```

Required secrets must stay in environment variables only:

```env
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
PHONE_AGENT_WEBHOOK_SECRET=
```

### Sources

- Linear issue `UNI-2140`.
- `package.json`.
- `prisma/schema.prisma`.
- `prisma/migrations/`.
- `src/app/api/customers/route.ts`.
- `src/lib/auth/data-scope.ts`.
- `src/lib/auth/workspace-scope.ts`.
- `src/lib/db/prisma.ts`.
- `src/lib/integrations/xero.ts`.
- `src/lib/integrations/xero-oauth.ts`.
- `src/lib/integrations/xero-storage.ts`.
- `src/lib/integrations/xero-tokens.ts`.
- `src/app/api/integrations/xero/**`.
- `src/lib/api/xero.ts`.
- `CleanExpo/Fabel-Prompt-Engineer` files: `CLAUDE.md`, `skills/fable-engine/SKILL.md`, `knowledge/board/senior-pm/profile.md`, `lib/evidence.ts`, `lib/supabase.ts`, `supabase/migrations/0004_spec_lineage.sql`, `tests/parsers.test.ts`.
