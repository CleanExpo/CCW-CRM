---
type: grill
component: margot-ccw
sketch: ../Sketches/07-margot-ccw.md
status: resolved (rounds 1+2, 2026-07-06)
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

---

# Round 2 — execution leaves (2026-07-06)

## Q9: Ownership split for finalisation between Rana and Toby?
**My recommendation:** Rana owns engineering, Toby owns CCW business acceptance, Phill arbitrates deadlocks.
**Phill's answer:** "We build, Rana Pollishes, and then help Toby with any final Walkthrough Connections required for handover."
**Resolution:** DECIDED — Unite-Group (Phill + Claude) builds; Rana polishes (QA/refinement pass on our PRs); Toby receives handover (final walkthrough + CCW-side connections: accounts, numbers, rosters).

## Q10: Who supplies the real recorded CCW calls for the STT accent bake-off?
**My recommendation:** Toby arranges 20–30 real Brisbane calls recorded in P0 (with the consent announcement active); fallback is staff-simulated calls if recording isn't practical pre-launch — because the gate is only meaningful on real caller audio.
**Phill's answer:** Toby arranges real calls (took recommendation).
**Resolution:** DECIDED — 20–30 real Brisbane calls recorded in P0 with consent announcement live.

## Q11: Which call types does Margot CONTAIN on day 1 at the Brisbane pilot, vs immediately transfer?
**My recommendation:** Contain: product/parts questions, stock & price, branch hours/pickup, SDS delivery, service-booking requests, draft orders. Always transfer: trade-account/credit issues, complaints, complex multi-line quotes, anything safety-ambiguous — start narrow on money-and-anger, wide on information.
**Phill's answer:** Info wide, money narrow (took recommendation).
**Resolution:** DECIDED

## Q12: Hard caps on a Margot draft order before forced transfer?
**My recommendation:** ≤$2,000 order value and ≤15 line items; over either limit Margot warm-transfers to sales — big orders are exactly the calls the sales team WANTS, and the cap is one config value we can raise as trust builds.
**Phill's answer:** $2,000 / 15 lines (took recommendation).
**Resolution:** DECIDED — config values, raisable post-pilot.

## Q13: Monthly spend ceiling for CCW's pilot Twilio + ElevenLabs accounts?
**My recommendation:** $500/mo combined alert threshold with hard review at $750 — at ~$0.10–0.15/min all-in that covers roughly 3,000–5,000 minutes, well above a single-branch pilot's volume, and it keeps the whole pilot under the $1k escalation line.
**Phill's answer:** $500 alert / $750 review (took recommendation).
**Resolution:** DECIDED

## Q14: Who works the draft-order finalisation queue each morning, and to what SLA?
**My recommendation:** The Brisbane named escalation contact owns the queue with a "cleared by 9:30am, nothing older than 24h" SLA — overnight capture only pays if a human converts it before the customer cools off; Toby confirms the person at handover.
**Phill's answer:** Branch contact, 9:30am SLA (took recommendation).
**Resolution:** DECIDED

## Q15: Margot's greeting — lock the wording now?
**My recommendation:** Lock this draft as the working version, subject only to counsel edits: "Hi, you've called Carpet Cleaners Warehouse Brisbane. I'm Margot, CCW's AI assistant — this call is recorded, and our privacy info is at ccwonline.com.au/privacy. How can I help?" — it hits all three legal requirements (recording consent, AI identity, APP 5 pointer) in under 9 seconds.
**Phill's answer:** Lock the draft (took recommendation).
**Resolution:** DECIDED — counsel gets final edit only.

---

## Final state — round 2

**Decided:**
- Delivery model: Unite-Group (Phill + Claude) builds; Rana polishes our PRs; Toby receives
  handover (walkthrough + CCW-side connections: accounts, numbers, rosters).
- Toby arranges 20–30 real recorded Brisbane calls (consent live) for the STT bake-off.
- Day-1 scope: info wide, money narrow — contain product/stock/price/hours/SDS/bookings/draft
  orders; always transfer trade-account/credit, complaints, complex quotes, safety-ambiguous.
- Draft-order caps: $2,000 / 15 lines (config, raisable post-pilot).
- Pilot spend: $500/mo combined alert, $750 hard review (Twilio + ElevenLabs).
- Queue: Brisbane named contact clears draft orders by 9:30am daily, nothing older than 24h.
- Greeting locked (counsel edit only): "Hi, you've called Carpet Cleaners Warehouse Brisbane.
  I'm Margot, CCW's AI assistant — this call is recorded, and our privacy info is at
  ccwonline.com.au/privacy. How can I help?"
- KPI baseline method (operational call, mine): 1-week manual call tally at Brisbane during P0
  (volume, type, duration, admin minutes) — feeds the 14-day success signals.

**Rabbit holes:** unchanged (per-site PBX discovery; porting decision).
**No-gos:** unchanged.
**Appetite:** unchanged — 6w Brisbane voice-live pilot.

**Next step:** decisions sync'd to CCW-CRM PR #239 docs; file tickets on Linear auth restore.
