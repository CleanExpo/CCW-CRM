---
type: pitch
component: margot-ccw
status: shaped
appetite: 6w
rabbit_holes:
  - per-site PBX identification + current after-hours call flows (P0 discovery)
  - number porting (deferred until containment rate proves out)
no_gos:
  - building on the Codex-owned MARGOT conversation-OS platform
  - voice cloning of a real person
  - live Cin7 API calls mid-conversation
  - bot completing orders or capturing payment (permanent)
linear_epic: TBD — CCW board unreachable (Linear auth dead); ticket pack ready
created: 2026-07-06
---

# Pitch — Margot for CCW: voice-live Brisbane pilot (first bet)

**Problem.** CCW's admin staff at Brisbane/Sydney/Melbourne answer the same product,
stock, SDS, and booking questions all day; after-hours calls are lost revenue; sales
orders start as scribbled messages. CCW asked for Margot — one AI brand voice across
phone, email, booking, orders, and marketing.

**Appetite.** 6 weeks to voice-live at ONE pilot branch (Brisbane). Email, booking
automation and marketing are the next bet, not this one.

**Solution (fat outline).**
- Extend the existing CCW-CRM phone-agent scaffold (UNI-2140) — not greenfield.
- CCW-owned Twilio + ElevenLabs accounts; existing branch number FORWARDS to a new
  Twilio 07 local; warm transfer to a named contact + ring group, with AI call summary.
- Knowledge core: pgvector over product text, parts/services, branch info, curated
  CARSI course subset; SDS PDFs harvested into CCW's own store, delivered VERBATIM
  only (read exact fields, send the document; never paraphrase; escalate on low
  confidence).
- Stock answers from ProductLocationStock at ~15-min sync; validation at draft-order
  creation.
- Draft orders: call session → proposed lines → draft Order/Quote, stock held to EOD,
  transcript attached, human finalisation queue. 24/7 including after hours.
- Compliance baked in: dual-disclosure greeting (recording + AI identity, satisfies
  NSW all-party via implied consent, OAIC AI-identification, APP 5), counsel sign-off
  gate before go-live; offer-based selling with live-true scarcity only (ACCC).
- Gate before build: AU-accent STT bake-off on real recorded CCW calls — accent
  accuracy is the binding constraint, per research.

**Evidence.** Sketch: ../Sketches/07-margot-ccw.md (full R&D, cited). Grill:
../Grills/07-margot-ccw.md (8/8 decided). Ticket pack: 17 tickets, phased P0–P4,
in session scratchpad `margot-ccw-linear-pack.json` — file to the CCW Linear board
on auth restore; P0+P1+P2 subset = this pitch's epic.

**Success signal (14 days post-ship).** ≥50% of pilot-branch calls contained by
Margot without transfer; ≥5 draft orders/week reaching the finalisation queue;
zero SDS paraphrase incidents (audit log check); admin time on phones measurably
down (baseline captured in P0).
