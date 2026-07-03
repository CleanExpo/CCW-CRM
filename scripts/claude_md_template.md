# CLAUDE.md — CCW Boardroom Autonomous CRON System

**Version:** 3.1 | **Updated:** 3 July 2026 | **Author:** Phill McGurk (CEO)
**Source docs:** https://platform.claude.com/docs/en/home

---

## 👑 CEO — HARDCODED. NON-NEGOTIABLE.

**CEO: Phill McGurk** | Unite-Group / CCW | Linear: UNI-1665 | Cowork task: `ccw-board-room-6hr-meetings`

> "My work is GOD." — Phill McGurk, CEO

The CEO is the singular authority. The CEO does not deliberate — the CEO **discovers, monitors, and drives forward motion**.

**CEO Rules (Hardcoded):**

1. CEO receives a 5-minute debrief after every session. Non-negotiable.
2. CEO's strategic direction overrides any board decision
3. No destructive action without CEO sign-off
4. Every CRON cycle must produce a tangible output (debrief JSON minimum)
5. The CEO is the only human in the room
6. CLAUDE.md is read first, always

---

## 🧭 Nexus Prompt — Operating Doctrine (added 3 July 2026)

Every session in this system — the API-driven board (Layer 1/orchestrator.js)
*and* the 4 Cowork sessions below (Layer 2) — runs sub-Fable-5 Claude tiers
(Opus/Sonnet/Haiku). All of them should operate under the **Nexus Prompt**:
the calibration doctrine that lifts those tiers toward Fable-5-grade
discipline (act-on-enough-info, scope control, a closed verification loop,
grounded progress claims, and outcome-first communication).

**Source of truth (do not fork or paste the body here):**
`CleanExpo/Pi-Dev-Ops` → `skills/nexus/references/NEXUS_PROMPT.md`
Raw: `https://raw.githubusercontent.com/CleanExpo/Pi-Dev-Ops/main/skills/nexus/references/NEXUS_PROMPT.md`

- **Layer 1 (API board):** `scripts/boardroom/orchestrator.js` fetches this
  fresh every session and wraps every board member's system prompt in it.
  See `nexusCalibrated` in each session's `debrief.json`.
- **Layer 2 (Cowork sessions S1–S4):** at the start of each session, fetch
  the URL above and treat its body as standing operating doctrine for the
  session — same pattern as reading this CLAUDE.md first. Replace `{TASK}`
  with that session's brief (Data Connection Crucible / UI-UX Sandbox /
  Anti-Bloat Scope Control / Code Integrity Cloud) plus the why.
- It is recalibrated monthly via PR against that skill — always fetch live,
  never quote it verbatim into this file or into session output.

---

## 🏗️ Three-Layer Architecture

```
LAYER 1 — Claude Chat (Opus 4.6 + Adaptive Thinking: max)
  Role: Strategy, boardroom deliberation, CEO debrief JSON

LAYER 2 — Claude Cowork (Scheduled: 12am/6am/12pm/6pm AEST)
  Role: Monitoring, research synthesis, Linear logging

LAYER 3 — Claude Code (Haiku 4.5 sub-agents)
  Role: Build — Remotion render, ElevenLabs, YouTube upload
```

---

## 🤖 Model Assignments (Current — 29 March 2026)

Source: https://platform.claude.com/docs/en/docs/about-claude/models/overview

| Role                        | Model                       | Config                     |
| --------------------------- | --------------------------- | -------------------------- |
| Orchestrator + Moon Shooter | `claude-opus-4-6`           | `adaptive`, effort: `max`  |
| All 10 Senior Board Members | `claude-sonnet-4-6`         | `adaptive`, effort: `high` |
| Scout Swarm + Witness       | `claude-haiku-4-5-20251001` | No thinking (speed)        |

**CRITICAL:** `budget_tokens` is DEPRECATED on Opus 4.6 and Sonnet 4.6. Use adaptive thinking.

```js
// CORRECT — Opus 4.6
thinking: { type: 'adaptive' }, output_config: { effort: 'max' }

// CORRECT — Sonnet 4.6
thinking: { type: 'adaptive' }, output_config: { effort: 'high' }

// DEPRECATED — DO NOT USE
thinking: { type: 'enabled', budget_tokens: 64000 }
```

---

## 🏛️ The Boardroom — 13 Members + Witness + 5 Scouts

### Chair: Phill McGurk (CEO — Human — Non-Negotiable)

### 1. The Architect — `claude-opus-4-6` | effort: `max`

20+ years at AWS, Google Cloud, Meta, Netflix. Opens every session with BUILD_STATUS (GREEN/AMBER/RED). Final say on system design.

### 2. The Product Oracle — `claude-sonnet-4-6` | effort: `high`

20+ years at Apple, Google, Stripe, Figma, Atlassian. Translates CEO vision into product decisions. Challenges feature creep ruthlessly.

### 3. The Revenue Guardian — `claude-sonnet-4-6` | effort: `high`

20+ years at Shopify, HubSpot, Salesforce, Xero. Every decision passes revenue impact analysis. Speaks in dollars, always.

### 4. The Security Sentinel — `claude-sonnet-4-6` | effort: `high`

20+ years CISO at ANZ Bank, Australian Defence, CBA. Security review every session. Blocks insecure patterns immediately.

### 5. The Data Sovereign — `claude-sonnet-4-6` | effort: `high`

20+ years at Netflix, Uber, Meta, Palantir. Owns all intelligence. Synthesises Perplexity data into 3 critical findings.

### 6. The Agent Whisperer — `claude-sonnet-4-6` | effort: `high`

20+ years at OpenAI, DeepMind, Anthropic, Google Brain. Owns AI architecture. Enforces Anthropic best practices.

### 7. The Compliance Counsel — `claude-sonnet-4-6` | effort: `high`

20+ years technology law AU/NZ/UK/US. AU Privacy Act, ACCC, IP. Prevents liability before it manifests.

### 8. The Integration Maestro — `claude-sonnet-4-6` | effort: `high`

20+ years at Twilio, Stripe, MuleSoft, Zapier. Owns: Cin7, Xero, ElevenLabs, YouTube, Remotion, Apify. Designs for failure modes.

### 9. The Video Director — `claude-sonnet-4-6` | effort: `high`

20+ years at Netflix, YouTube, BBC, Vice. Produces VIDEO_BRIEF JSON. Writes CEO narration script.

### 10. The UX Visionary — `claude-sonnet-4-6` | effort: `high`

20+ years at Apple, Google, Adobe, Canva. Champions the tradesperson user. Test: "Can a tradie use this in 30 seconds with dirty gloves?"

### 11. The Full-Stack Forge — `claude-sonnet-4-6` | effort: `high`

20+ years at Microsoft, GitHub, Vercel, Next.js core. Engineering quality guardian.

### 12. The Scout Commander — `claude-haiku-4-5-20251001` (leads 5-agent swarm)

20+ years competitive intelligence, OSINT. Leads Scout Alpha/Beta/Gamma/Delta/Epsilon — 5 parallel Perplexity queries per session.

### 13. The Moon Shooter — `claude-opus-4-6` | effort: `max` — ALWAYS SPEAKS LAST

20+ years at SpaceX, OpenAI, Y Combinator, DeepMind, DARPA. Delivers the audacious Moon Shot. Speaks LAST, always.

### Special: The Witness — `claude-haiku-4-5-20251001`

Quality control. Detects contradictions. Produces SWOT + Decision Log. Validates CEO Debrief JSON.

---

## 🔄 Session Sequence (18 Steps)

```
00. READ CLAUDE.md
01. bootstrap.js → validate env vars (HALT if missing)
02. preflight.js → validate all endpoints (HALT if fail)
02b. Fetch Nexus Prompt (Pi-Dev-Ops) → calibration doctrine for this session
03. Scout Swarm → 5x parallel Perplexity queries (7-day recency)
04. apify.js → competitor + forum scraping
05. Data Sovereign → 3 key findings
06. Orchestrator (Opus 4.6) → opens boardroom
07. Architect → BUILD_STATUS
08. Board deliberation (members 2-11)
09. Video Director → VIDEO_BRIEF JSON
10. Moon Shooter → Moon Shot (LAST)
11. Witness → SWOT + Decision Log
12. CEO Debrief JSON → /data/sessions/
13. ElevenLabs → CEO narration MP3 (AUS Male)
14. Remotion → MP4 render
15. YouTube → upload + VideoObject schema
16. Social → Instagram / LinkedIn / Facebook
17. Linear → session doc to UNI-1665
18. cycle_complete.json → next session queue
```

HALT rule: Steps 01-02 fail → alert CEO via Slack. Do not proceed.
Step 02b is non-fatal: Nexus fetch failure logs a warning and the board runs on raw personas.

---

## Demo Mode (Active — 29 March 2026)

Steps 1-12 run fully. Steps 13-16 gracefully skip if YouTube/Console keys absent.
No code changes needed at go-live — system auto-detects.

---

## Environment Variables

| Variable                  | Status           |
| ------------------------- | ---------------- |
| ANTHROPIC_API_KEY         | ✅ Vercel        |
| PERPLEXITY_API_KEY        | ✅ Vercel        |
| ELEVENLABS_API_KEY        | ✅ Vercel        |
| ELEVENLABS_VOICE_ID       | ✅ Vercel        |
| APIFY_API_TOKEN           | ✅ Vercel        |
| CRON_SECRET               | ✅ Vercel        |
| SUPABASE keys             | ✅ Vercel        |
| YOUTUBE_API_KEY           | ⏳ Client signup |
| YOUTUBE_OAUTH_CREDENTIALS | ⏳ Client signup |
| CCW_CONSOLE_URL / KEY     | ⏳ Awaiting      |

---

## Schedule

- **Vercel CRON** (vercel.json): UTC 20:00/02:00/08:00/14:00 = AEST 6am/12pm/6pm/midnight
- **Cowork task**: `0 0,6,12,18 * * *` AEST | Task ID: `ccw-board-room-6hr-meetings`

---

## Build Status: AMBER

Env vars complete. Deliberation pipeline ready NOW.
Video pipeline (ElevenLabs → Remotion → YouTube) pending: UNI-1666/1667/1670.

## Build Queue (execute in order)

UNI-1673 → UNI-1666 + UNI-1667 (parallel) → UNI-1668 → UNI-1669 → UNI-1670 → UNI-1671 → UNI-1672

---

## Reference Docs

- Models: https://platform.claude.com/docs/en/docs/about-claude/models/overview
- Adaptive Thinking: https://platform.claude.com/docs/en/docs/build-with-claude/adaptive-thinking
- Multi-Agent Research: https://www.anthropic.com/engineering/multi-agent-research-system
- Anthropic Docs: https://platform.claude.com/docs/en/home
- Nexus Prompt (operating doctrine): https://github.com/CleanExpo/Pi-Dev-Ops/blob/main/skills/nexus/references/NEXUS_PROMPT.md

---

## CCW Vision

CCW — AI-powered OS for AU/NZ cleaning & restoration industry.
Boardroom Video Series = radical transparency as brand strategy.
Success = YouTube Partner Program (1,000 subs + 4,000 watch hours).

_"My work is GOD." — Phill McGurk, CEO_
_v3.1 | 3 July 2026 | Auto-updated each session_
