---
type: grill
component: margot-ccw
sketch: ../Sketches/07-margot-ccw.md
status: resolved
created: 2026-07-06
---

# Grill transcript — Margot for CCW (omni-channel AI brand voice)

Resolving the 8 open questions from the R&D report, dependency-first.

## Q1: Does Margot-for-CCW live inside CCW-CRM, fully separate from the Codex-owned MARGOT platform?
**My recommendation:** Yes — build entirely inside CCW-CRM. The MARGOT conversation-OS is hands-off (Codex-owned, in-flight); CCW owns its own Twilio/ElevenLabs accounts and data, so sharing only the *name* keeps the SaaS-client boundary, the privacy posture, and the no-collision rule clean.
**Phill's answer:** Inside CCW-CRM (took recommendation).
**Resolution:** DECIDED

## Q2: Where do CCW's actual SDS PDFs live today, and are they current?
**My recommendation:** Treat the manufacturer/supplier portals as the source and build a P0 discovery sub-task to collect them into CCW's own store (Supabase Storage), because the CRM only holds `sdsPdfUrl` pointers and a knowledge layer can't retrieve from URLs nobody has verified.
**Phill's answer:** Collect into CCW's own store (took recommendation).
**Resolution:** DECIDED — P0 sub-task: harvest SDS PDFs from manufacturer portals into Supabase Storage, verify 5-year currency, pipeline reads only from that store.

## Q3: What phone system does CCW run per site, and do the existing numbers PORT to Twilio or FORWARD to it?
**My recommendation:** Forward first, port later — go live by forwarding existing branch numbers to the three new Twilio locals (zero risk, reversible same-day), and only port once Margot's containment rate proves out. Porting on day one couples go-live to a 2-6 week carrier process and makes rollback painful.
**Phill's answer:** Forward first, port later (took recommendation). PBX stack per site still to be identified in P0 discovery.
**Resolution:** DECIDED (cutover strategy) + RABBIT HOLE (per-site PBX identification stays a P0 discovery ticket)

## Q4: Who answers Margot's warm transfers at each branch, and during what hours?
**My recommendation:** One named escalation contact per branch plus a fallback ring group, captured as fields on the new Branch model — because a warm transfer with nobody rostered to catch it is worse than voicemail, and the transfer target is config, not code.
**Phill's answer:** Named contact + ring group per branch (took recommendation). Roster collected from CCW ops in P0 discovery.
**Resolution:** DECIDED

## Q5: Can CCW's Cin7 plan take live stock lookups on every call?
**My recommendation:** Don't hit Cin7 live at all — serve stock answers from the CRM's own `ProductLocationStock` (already Cin7-synced) and raise the sync cadence from nightly to ~15-minutely; a phone answer that's ≤15 min stale is honest ("around N in stock at Sydney") and immune to Cin7 rate limits and mid-call API latency.
**Phill's answer:** CRM table + 15-min sync (took recommendation).
**Resolution:** DECIDED — Margot reads ProductLocationStock; sync cadence ticket added to P1; draft-order lines still validated at creation time.

## Q6: Which voice is Margot's, and is it licensed for commercial CCW use?
**My recommendation:** A stock ElevenLabs professional voice from CCW's own account (commercially licensed by subscription), tuned to the brand — not a clone of any real person; cloning requires documented consent and adds legal surface for zero launch value.
**Phill's answer:** Stock ElevenLabs voice on CCW's account (took recommendation).
**Resolution:** DECIDED — AU-accent professional stock voice, no cloning.

## Q7: After hours, does Margot take draft orders 24/7 or message-only?
**My recommendation:** Full service 24/7 — taking a draft order at 9pm for the sales team to finalise at 8am is exactly the product's value ("free up admin staff"), the draft-order gate means nothing irreversible can happen overnight, and after-hours capture is where a human-staffed line loses revenue.
**Phill's answer:** Full service 24/7 (took recommendation).
**Resolution:** DECIDED — human-approval gate is the overnight safety; after-hours capture is core value.

## Q8: What is the source of truth for the CARSI course catalog Margot cites?
**My recommendation:** The CARSI platform's Prisma catalog (verified in repo: seed/export scripts, incl. an existing "2 Day CARSI – CCW Course"), synced read-only into the knowledge core — curated to a CCW-relevant tagged subset.
**Phill's answer:** CARSI platform DB, curated CCW subset (took recommendation).
**Resolution:** DECIDED

---

## Final state

**Decided:**
- Build lives entirely inside CCW-CRM; only the name is shared with the Codex-owned MARGOT platform.
- SDS: harvest PDFs from manufacturer portals into CCW's own store (Supabase Storage), verify 5-year currency; pipeline reads only from that store. Verbatim-only delivery stands.
- Phone cutover: forward existing branch numbers to three new Twilio locals; port only after containment proves out. CCW owns its Twilio + ElevenLabs accounts.
- Escalation: named contact + fallback ring group per branch, stored on the Branch model; roster from CCW ops in P0.
- Stock: Margot answers from ProductLocationStock with sync raised to ~15-min; live validation only when a draft-order line is created.
- Voice: stock ElevenLabs AU professional voice on CCW's account; no cloning.
- After hours: full service 24/7 — draft orders + bookings overnight, humans finalise in the morning.
- CARSI: read-only sync from the CARSI Prisma catalog, curated CCW-tagged subset.

**Rabbit holes (to be revisited):**
- Per-site PBX identification + current after-hours call flows (P0 discovery ticket).
- Number porting (deferred until containment rate proves out).

**No-gos (explicitly excluded):**
- Building on the MARGOT conversation-OS platform (Codex-owned, hands-off).
- Voice cloning of a real person.
- Live Cin7 API calls mid-conversation.
- Bot completing orders / capturing payment (permanent, from R&D never-do list).

**Appetite (Shape Up time budget):** 6w — voice-live at Brisbane pilot: P0 foundations + knowledge core + SDS delivery + draft orders. Email/booking/marketing are the next bet.

**Next step:** promote to `Pitches/07-margot-ccw.md`; file the ticket pack to the CCW Linear board once Linear auth is restored.
