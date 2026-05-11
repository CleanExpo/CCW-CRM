# DESIGN.md — CCW (Carpet Cleaners Warehouse)

> The brand contract every AI agent (Claude Code, Claude Design, Cursor, v0, Aura)
> reads before producing UI, copy, or motion for this repo. Source of truth at
> `Synthex/packages/brand-config/src/brands/ccw.ts`. This file is the human-
> and agent-readable projection plus Phill's 7 non-negotiable rules.
>
> Updated: 2026-05-11. Spec: Google DESIGN.md v1 (community implementation).
>
> **First paying client of the autonomous agency.** Every surface here goes
> in front of a real customer.

---

## Brand Voice

- **Legal name:** Carpet Cleaners Warehouse
- **Display name:** CCW
- **Tagline:** Trade prices. Same-day dispatch.
- **Audience:** professional carpet cleaners and restoration trades (AU)
- **Tone:** warm, urgent, trade-direct, product-knowledgeable.
- **Cadence:** short. Hit the value fast.
- **Voice register:** No retail fluff. No consumer-brand warmth. No
  aspirational lifestyle language. The reader is a working tradesperson
  ordering between jobs.
- **Default channel:** Instagram.

---

## Visual Tokens

### Colour
| Token | Hex | Use |
|---|---|---|
| `--ccw-primary` | `#D62828` | Red — brand primary (CTA / hero only) |
| `--ccw-secondary` | `#003049` | Navy — body chrome |
| `--ccw-accent` | `#F77F00` | Orange — secondary action |
| `--neutral-50` | `#FFFFFF` | Canvas |
| `--neutral-100` | `#F5F5F5` | Surface |
| `--neutral-500` | `#737373` | Muted text |
| `--neutral-900` | `#1A1A1A` | Body text |
| `--success` | `#3FA34D` | Pass |
| `--warning` | `#E0A800` | Attention |
| `--danger` | `#7B0F0F` | Danger |

### CEO-Surface Overlay Tokens (Phill Rule 6)

| Token | Hex | Use |
|---|---|---|
| `--canvas` | `#0e1014` | Gun Metal — CEO views |
| `--red-500` | `#b30000` | Candy Red — CEO actions |
| `--orange-400` | `#e07020` | CEO secondary |
| `--green-500` | `#00a854` | CEO success |

### Typography
- **Display:** Outfit, weight 800 (retail energy).
- **Body:** Inter, weight 400.

### Radius
- CEO register: 4–6px (sharp).
- Customer / shop register: 10px (soft).

### Motion
- **Signature:** pulse (retail urgency — fast, snappy).
- Durations (frames @ 30fps): fast 6, base 14, slow 28.
- Easing: overshoot in (`cubic-bezier(0.34, 1.56, 0.64, 1)`), back-out
  (`cubic-bezier(0.36, 0, 0.66, -0.56)`).
- Transition between scenes: 10 frames.

---

## Forbidden Patterns

### Icons (Phill Rule 1)
- **NO Lucide, HeroIcons, FontAwesome, or any other icon library in app code.**

### AI-Slop Phrases (brand-guardian global banned list)
- "In today's fast-paced world", "Game-changer", "Seamless" (unless quoting),
  "Leverage" (as verb), "Robust", "Cutting-edge", "State-of-the-art",
  "Dive into" / "delve into", "It's worth noting", "In conclusion" / "To
  summarise" as paragraph openers, "Our passionate team", "End-to-end
  solution", "Best-in-class", "Empower" / "empowering", "Unlock [potential]",
  rhetorical question paragraph openers.

### CCW-Specific Forbidden
- Never claim products are "the cheapest" — use "trade pricing" instead.
- Never use red type on coloured backgrounds — reserve red for hero / CTA.
- `cheap`, `discounted` (in `forbiddenWords`)
- No consumer-brand warmth.
- No aspirational lifestyle copy ("transform your space", "elevate your
  cleaning experience").

### Visual
- No generic AI aesthetics.
- **CCW logo is real and embedded** — scraped from ccwonline.com.au Shopify
  CDN (2953×525px). Never replace with initials or placeholder.
- No Lorem ipsum.

---

## Required Patterns

### Custom Geometric Marks (Phill Rule 2 — Option B)
- 24×24 viewBox, 1.5px stroke, square caps, miter joins, sharp corners,
  1–3 paths max, derived from the hexagon in the Unite-Group logo mark.

### Real Logos (Phill Rule 4)
- CCW logo is the real Shopify CDN asset. Stored at `public/logos/ccw.png`.
- Use `BusinessLogo` component with geometric-mark fallback for any other
  business referenced.

### Customer-Facing Trade Surfaces
- **Product listings:** SKU + trade price + stock state + same-day-dispatch
  badge. No marketing fluff above the fold.
- **Cart / checkout:** prices in AUD ex-GST then inc-GST clearly labelled.
- **Order status:** explicit time-of-dispatch, not "soon".

### CEO-Facing Surfaces (Phill Rule 5)
- Show **WHAT TO DO**, not just metrics.
- Health scores in the background strip, not the headline.
- Every metric paired with an action (e.g. "$8.2k unfulfilled orders → ship
  next 3 by 2pm").

### Design Tokens (Phill Rule 6)
- No hardcoded colours, radii, or typography. Use the tokens above.

### Autonomy (Phill Rule 7)
- Manual processes (order pulling, stock alerts, reorder POs, customer
  follow-ups) must be automated. Toby's holiday window (May 11–25, see
  `~/2nd Brain/2nd Brain/Wiki/ccw.md`) means the system must run without
  manual interventions during that period.

---

## Approval Gates

CCW is a **paying client** — every surface gets double scrutiny.

1. **brand-guardian skill** returns `APPROVED`. Client-facing extra scrutiny
   per brand-guardian Step 5.
2. **qa-lead skill** passes the rubric.
3. **One hallucination = automatic REVISE.** No exceptions.
4. **The $2B filter** — CCW is the lighthouse customer for the autonomous
   agency model. Every surface either advances that proof or blocks the merge.
5. **Pricing accuracy** — any displayed price must match the live Shopify
   product feed. No stale prices in cached components without explicit TTL.

---

## CI Lint Integration

This repo runs the DESIGN.md lint on every PR via
`.github/workflows/design-lint.yml`. The lint asserts:

1. `.claude/DESIGN.md` exists.
2. All 6 required H2 headings are present.
3. No **net-new** imports from `lucide-react`, `@heroicons/react`, or
   `@fortawesome/*`. Baseline at `.github/design-md-lint.baseline.txt`.
4. AI-slop phrase scan (warn-only in v1).

To run locally: `bash .github/scripts/design-md-lint.sh`.

Existing CI surfaces in this repo: `ci.yml`, `boardroom-ci.yml`,
`agent-pr-checks.yml`, `deploy-staging.yml`, `deploy-production.yml`,
`rollback.yml`, `security.yml`. design-lint runs alongside on every PR.

---

## References

- Source of truth (typed): `Synthex/packages/brand-config/src/brands/ccw.ts`
- Visual tokens (.design.md): `Synthex/packages/brand-config/src/brands/ccw.design.md`
- CCW wiki page: `~/2nd Brain/2nd Brain/Wiki/ccw.md`
- Phill's 7 design rules: `~/.claude/projects/-Users-phill-mac-2nd-Brain/memory/feedback_design_preferences.md`
- Brand guardian skill: `~/.claude/skills/brand-guardian/SKILL.md`
- Holiday window: `~/.claude/projects/-Users-phill-mac-2nd-Brain/memory/project_ccw_holiday_window.md`
