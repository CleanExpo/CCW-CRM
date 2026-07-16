# Margot for CCW — Omni-channel AI Brand Voice: R&D Report (draft)

Date: 2026-07-06 · Status: assembling (repo recon + SDS/orders research pending)

## Scope (per Phill, 2026-07-06)
Margot is the voice behind the CCW brand across ALL channels for Brisbane / Sydney / Melbourne:
1. Inbound phone (Twilio) — all incoming calls: Shopify/store, Service Bay, Dispatch, Ordering
2. Email — inbound answering + outbound customer emails
3. Service booking — service-bay scheduling
4. Marketing campaigns — lifecycle/campaign email (via Synthex, human-approved sends)
5. Draft sales orders — completed and ready for sales team to finalise
6. Knowledge: product lines, SDS, parts & services, entire CCW-ERP-CRM, CARSI training tie-in
7. Selling style: offer-based ("sell by offering"), FOMO built in — WITHIN ACCC limits (no false scarcity)

## Deep-tier steer (margot deep_research, corpus-anchored — internal advisory, uncited)
- ONE "Cognitive Core": shared knowledge base (vector store on Supabase/Postgres) + shared memory
  + one Margot persona prompt; per-channel tone adapters (voice = terse/interruptible; email =
  detailed/formatted). Multi-bot-per-channel fails on shared state (customer references an email
  on a phone call).
- Build, don't buy: stack is already Vercel + Supabase + Claude; Twilio for voice/SMS, Resend-class
  for email. Off-the-shelf omni platforms fail at bespoke ERP sync.
- Booking = function-calling agent: check_availability / book_appointment tools against CCW-CRM.
- Outbound marketing: AI drafts + segments, human clicks approve/send (Spam Act 2003: consent,
  sender ID, unsubscribe; ACMA enforcement risk). Transactional sends (booking confirmations,
  receipts) can be autonomous.
- SDS: bounded RAG — quote/cite the SDS verbatim or hard-fallback to human escalation. Never
  paraphrase hazard/first-aid/mixing content. Optional second "safety monitor" agent screens
  outputs.

## Voice architecture (field research, cited — see claims appendix)
DECISION: Twilio ConversationRelay directly (not Vapi/Retell/Bland; not raw Media Streams).
- ConversationRelay GA since 2025-05; managed STT/TTS/barge-in; our app owns LLM + tools over
  WebSocket. Claude function-calling is a documented Twilio pattern. ~$0.07/min Twilio +
  ~$0.15–0.25/min all-in est. AU local numbers $3/mo + $0.01/min inbound.
- 3 branch-local numbers (Brisbane 07, Sydney 02, Melbourne 03) → one shared backend;
  branch passed via <Parameter branch=...> into customParameters; every KB/tool call scoped
  by branch (stock, hours, pickup). National 1300/1800 line only as marketing fallback.
- Warm transfer to branch staff (SIP Dial + UUI context; Twilio Agent Connect pattern hands the
  human an AI-generated call summary).
- BINDING CONSTRAINT: ASR accuracy on Australian accents (peer-reviewed structural WER gap vs
  US English; worse with warehouse/van noise). First engineering step = STT bake-off (Deepgram
  vs Google) on recorded real CCW calls. Latency target: ~885ms median turn gap (Twilio bench).
- Compliance: QLD one-party; VIC one-party (but s11 limits sharing recordings); NSW all-party —
  implied consent via announcement. ONE greeting covers all: "this call is recorded and you're
  speaking with Margot, CCW's AI assistant" + APP 5 privacy pointer. OAIC requires AI to identify
  itself. Not court-tested — AU privacy counsel review before launch. Twilio AU number KYC:
  ASIC extract, ABN/ACN, AU address, rep ID.

## Selling layer (offer-based + FOMO)
- Persona sells by OFFERING: suggest the bundle/alternative/booking, never push. Attach CARSI
  training as value-add ("that machine pairs with the CARSI certification course").
- FOMO limits: real scarcity/real deadlines only (actual stock counts, actual promo end dates
  from CRM). Fabricated urgency = misleading conduct under ACL (ACCC position — pending agent
  citation). Bot reads FOMO facts from CRM fields, never invents them.

## CARSI tie-in
CARSI (portfolio training business) backs CCW's brand authority: Margot cites relevant CARSI
courses when advising on products/services; cross-sell path phone→email follow-up with course
link; positions CCW as "the supplier that trains you", differentiator vs commodity suppliers.

## SDS layer (field research, cited)
- CCW's legal role = SUPPLIER: must provide the current SDS at/before first supply and on request,
  free (WHS Reg 339, Safe Work Australia). SDS must be ≤5 years since review (Reg 330, GHS 7 since
  2023-01-01). Bot must check a "last reviewed" date, not just "SDS exists".
- Regulatory whitespace: NO Australian regulator guidance exists on AI paraphrasing SDS content.
  The divergence finding: absence of guidance is the risk signal — closest real incidents (NZ
  supermarket bot inventing bleach+ammonia recipe; NYC MyCity bot giving illegal advice) argue
  VERBATIM-ONLY delivery: send the actual SDS PDF (email/SMS), read exact field text aloud, never
  summarise hazard/first-aid/PPE/mixing content.
- Liability: Moffatt v Air Canada (2024) — company liable for chatbot's wrong policy statement;
  bot = the company speaking. ACL s18 misleading conduct needs NO intent. The call recording
  becomes the evidence, not a shield. Log which SDS version/section was read, and when.

## Draft-order layer (field research, cited)
- Shopify GraphQL `draftOrderCreate`: needs `write_draft_orders` scope ONLY (never write_orders /
  payment scopes). No payment at creation; `draftOrderComplete` stays human-only.
- Inventory NOT reserved by default — set `reserveInventoryUntil` to a short window (e.g. EOD).
- Order note/metafields carry: call transcript, what was verbally confirmed, AI confidence flags —
  the sales rep sees exactly what was promised before finalising.
- Guardrail consensus: human gate before completion; scoped credentials; full audit trail
  (inputs, model version, timestamp, guardrail checks, human approval); hard per-order qty/spend cap.

## Selling-evidence caveat (divergence finding)
Vendor "AI upsell lifts revenue ~20%" figures are unverified marketing. Independent data (Gartner
2025: 53% distrust AI recommendations; Harris: AI-labelled products can sell WORSE) says suggestive
selling is a trust risk to handle with restraint: offer once, don't repeat, disclose it's Margot.
Do not size ROI on vendor numbers.

## ACCC FOMO bright line (Tier-1, directly fetched)
Scarcity claims are legal ONLY if true at the moment the customer hears them ("upfront and clear
about short supply / limited time" — ACCC). Emma Sleep enforcement: looping countdown timers =
misleading. Margot's FOMO must be generated from LIVE ERP stock/promo fields, never scripted.

## CCW-CRM repo reality (recon, HEAD 187606b, clone at scratchpad/ccw-crm-recon)
KEY FINDING: a real "CCW Phone Agent" scaffold ALREADY EXISTS (spec UNI-2140, June 2026):
- Working: Twilio inbound webhook w/ X-Twilio-Signature validation; ElevenLabs conversation
  callback w/ HMAC; call-session persistence (hashed caller numbers); keyword triage → 7 intents +
  human-handoff; draft-only follow-ups w/ human approve/reject; dashboard page; go-live runbook
  (docs/ccw-phone-agent-live-readiness.md). Outbound calls/recording/order-creation hardcoded OFF.
- Architecture as built: live conversation delegated to ELEVENLABS HOSTED AGENT
  (ELEVENLABS_AGENT_ID); CRM ingests transcripts post-call. Twilio route itself returns static TwiML.
- Stale docs warning: docs/ describe a Python/FastAPI backend + pgvector RAG + 9 agents that
  NEVER EXISTED in git history. Verified against code, not docs.
- Reusable: POST /api/orders + /api/quotes (credit limit, price tiers, Cin7-synced products);
  ProductSds metadata (signal word, hazard codes, revisionDate/reviewDueDate, sdsPdfUrl);
  /api/inventory/by-location over hardcoded ['brisbane','sydney','melbourne'].
- Cin7 is system of record; Shopify is downstream (orders pulled in nightly, stock/price pushed
  out; NO webhook receiver). Only descriptive product text in the whole system = public
  storefront feed ccwonline.com.au/products.json (disconnected from Product table).
- Top 5 gaps (verified): (1) knowledge/RAG layer — CcwAiKnowledgeSource is an empty registry, no
  ingestion/embeddings/retrieval; SDS PDFs never parsed; (2) no mid-call tool bridge (stock/price/
  customer lookups); (3) draft-order-from-call spec'd but never built (zero order.create in
  phone-agent code); (4) service auth = all-powerful CRON_SECRET impersonation, no scoped keys,
  no RBAC on phone-agent admin; (5) no first-class Branch model (strings + mock POS store).

## ARCHITECTURE DECISION (revised after recon)
Extend the EXISTING ElevenLabs-hosted-agent scaffold for MVP — do not greenfield on
ConversationRelay. Rationale: security plumbing, session model, human-approval loop, dashboard
and go-live runbook already exist and were signed off (UNI-2140); ElevenLabs Agents supports
tool webhooks for mid-call lookups; per-minute economics ($0.08/min + LLM at cost) are acceptable
at CCW call volumes. ConversationRelay remains the documented migration path if ElevenLabs tool
latency or cost bites at scale — the tool endpoints we build are transport-agnostic either way.
Flip-test: the strongest counter is platform lock-in + markup; mitigated because Twilio owns the
numbers (SIP layer swappable) and all tools/knowledge live in CCW-CRM, not in ElevenLabs.

## PHASED BUILD PLAN
P0 Foundations: STT bake-off on real AU calls (gate: acceptable WER); compliance pack (dual-
   disclosure greeting, counsel review, Twilio AU regulatory bundle); scoped voice-agent API key
   replacing CRON_SECRET; RBAC on phone-agent admin; first-class Branch model.
P1 Knowledge core: pgvector ingestion (product text from storefront feed + Cin7, parts/services,
   branch info, CARSI catalog); SDS pipeline (parse PDFs → verbatim field store, staleness check
   vs reviewDueDate, email/SMS delivery, never-paraphrase guard + human fallback); retrieval API
   with cited-answer contract.
P2 Voice live: mid-call tool endpoints (stock-by-branch, tiered price, customer-by-phone, hours,
   SDS-send, service-slot); Margot persona on ElevenLabs agent; 3 branch numbers → branch param;
   warm transfer + AI call summary; draft-order flow (session → lines → draft Order/Quote,
   reserveInventoryUntil EOD, transcript in note, human finalisation queue).
P3 Email + booking: inbound email answering from same knowledge core (human-approved initially);
   autonomous transactional sends only; service-bay booking against WorkshopBooking.
P4 Selling + marketing: offer-engine (live-FOMO from ERP stock/promo fields ONLY, offer-once
   rule, CARSI course attach); campaigns via Synthex with human approve/send; KPI dashboard
   (deflection, draft-order conversion, transfer rate).

## ACCOUNTS & PHONE-SYSTEM INTEGRATION (per Phill, 2026-07-06)
- CCW owns its OWN Twilio and ElevenLabs accounts (their bill, their data-controller posture —
  cleaner for privacy/APP compliance and for the SaaS-client boundary). Unite-Group is delegated
  admin on both. Twilio AU regulatory bundle is filed under CCW's ABN/ASIC details.
- Margot fronts CCW's EXISTING phone system: integration pattern = Twilio numbers (new or ported)
  answer first; warm transfers bridge into the current phone system per branch (SIP trunk if their
  PBX supports it, else PSTN forward to existing branch numbers). Discovery ticket: identify the
  PBX/phone stack per site (hosted PBX? Teams Voice? analogue?), whether numbers will PORT to
  Twilio or FORWARD to it, and after-hours call flows currently configured.

## OPEN QUESTIONS FOR PHILL (blind-spot pass)
1. MARGOT boundary: this plan builds "Margot for CCW" INSIDE CCW-CRM (new code, our lane). The
   MARGOT conversation-OS itself is Codex-owned/hands-off. Confirm that split is the intent.
2. Where do the actual SDS PDFs live today, and are they current? Repo stores URLs only — if the
   URLs are dead, P1's SDS pipeline has no source.
3. Escalation roster: who answers warm transfers per branch, and what are real branch hours?
4. Cin7 API plan limits: can it take live stock lookups on every call?
5. What is CCW's current phone system per site, and port vs forward the existing numbers?
6. Margot's voice: which voice asset, and is it licensed for commercial CCW use?
7. After-hours: take draft orders 24/7, or message + next-day callback?
8. CARSI catalog: source of truth for course data Margot should cite?

## Linear status
All local Linear keys 401 (dead); claude.ai connector needs re-auth; Composio key rejected.
Tickets will be prepared as an import-ready pack; filing needs /mcp re-auth or fresh lin_api_ key
in ~/Pi-CEO/Pi-Dev-Ops/.env.local.
