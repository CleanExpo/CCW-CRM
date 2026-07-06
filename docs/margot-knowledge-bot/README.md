# Margot Knowledge Bot — shaping pack (2026-07-06)

Margot is CCW's AI brand voice: inbound phone (Twilio), email, service-bay booking,
draft sales orders, and marketing — one shared knowledge core (products, parts,
services, SDS, branches, CARSI courses) with per-channel adapters, for Brisbane,
Sydney and Melbourne.

**Owners to finalise: Rana + Toby.** Phill has ratified the decisions in
`decisions-grill.md`; the first bet is scoped in `pitch-6w-brisbane-pilot.md`.

## Files

| File | What it is |
|---|---|
| `RND-REPORT.md` | Full R&D: architecture decision (extend the existing UNI-2140 phone-agent scaffold), voice stack research (cited), SDS/WHS + recording-consent + ACCC compliance findings (cited), repo recon (verified against code at HEAD 187606b), phased build plan P0–P4 |
| `decisions-grill.md` | The 8 locked decisions + rabbit holes + no-gos + 6-week appetite |
| `pitch-6w-brisbane-pilot.md` | The first bet: voice-live at Brisbane — scope, success signals |
| `linear-ticket-pack.json` | 17 tickets, phased, ready to import to the CCW Linear board |

## The five hard rules (non-negotiable, from the R&D)

1. SDS content is delivered VERBATIM only — send the document, read exact fields;
   never paraphrase hazard/first-aid/PPE/mixing content; low confidence → human.
2. Margot never completes an order or touches payment — draft orders only, human
   finalisation queue.
3. Scarcity/urgency claims must be live-true from ERP data at the moment spoken
   (ACCC bright line — Emma Sleep precedent).
4. Every call opens with the dual disclosure: recorded + "you're speaking with
   Margot, CCW's AI assistant" + privacy pointer (NSW all-party consent, OAIC).
5. Voice-agent service gets scoped credentials — never the CRON_SECRET owner
   impersonation.

## Build home

This repo (`CleanExpo/CCW-CRM`), extending `src/lib/phone-agent/` and
`src/app/api/phone-agent/`. CCW's own Twilio + ElevenLabs accounts. The
Codex-owned MARGOT conversation-OS platform is explicitly out of scope.
