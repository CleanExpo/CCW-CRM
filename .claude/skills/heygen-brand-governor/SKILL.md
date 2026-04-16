---
name: heygen-brand-governor
version: 1.0.0
description: |
  Single source of truth for HeyGen avatar, voice, dimension, and background selection
  across all CCW demo video productions. Ensures brand consistency across batch runs.
  Use when: producing any HeyGen video, selecting avatars/voices, or reviewing brand compliance.
allowed-tools:
  - Read
  - Bash
  - Grep
---

# HeyGen Brand Governor — CCW Demo Video Standards

## Avatar Roster

| Role                | Avatar ID                | Name  | Gender | Assignment                                                        |
| ------------------- | ------------------------ | ----- | ------ | ----------------------------------------------------------------- |
| Primary Presenter   | `Daisy-inskirt-20220818` | Daisy | Female | Module demos, executive overviews, CRM modules                    |
| Technical Presenter | `josh_lite3_20230714`    | Josh  | Male   | Feature walkthroughs, technical integrations, warehouse/inventory |
| Alternate           | `Anna_public_3_20240108` | Anna  | Female | Batch rotation variety, POS, settings, comparison videos          |

**Rotation rule:** Maximum 2 consecutive videos with the same avatar before switching.

## Voice Roster

| Voice ID                           | Name  | Gender | Assignment                       |
| ---------------------------------- | ----- | ------ | -------------------------------- |
| `1bd001e7e50f421d891986aad5158bc8` | Sarah | Female | All Daisy and Anna presentations |
| `2d5b0e6cf36f460aa7fc47e3eee4ba54` | James | Male   | All Josh presentations           |

## Voice Persona

Australian equipment supplier CEO. Direct, practical, numbers-driven.

### 5 Voice Rules

1. **Open with a concrete pain point** — "You're spending 3 hours a week on stock counts that should take 10 minutes"
2. **Use "you" directly** — never "users", "customers", or "one"
3. **Include at least one specific number per 60 seconds** — percentages, dollar amounts, time savings
4. **End with forward-momentum CTA** — "Head to your dashboard and try it now" not "Thanks for watching"
5. **Never use** — "Welcome to", "Today we're going to", "Thanks for watching", "In this video"

## Dimensions

| Platform                     | Width | Height | Aspect |
| ---------------------------- | ----- | ------ | ------ |
| YouTube / LinkedIn / Website | 1920  | 1080   | 16:9   |
| Instagram Reels / TikTok     | 1080  | 1920   | 9:16   |
| Default (API)                | 1280  | 720    | 16:9   |

## Backgrounds

| Video Type          | Background | Hex       |
| ------------------- | ---------- | --------- |
| Module demo         | White      | `#FFFFFF` |
| Executive overview  | Dark navy  | `#1a1a2e` |
| Feature walkthrough | Light grey | `#f8fafc` |
| Comparison / Sales  | White      | `#FFFFFF` |

## YouTube Channel

- **Channel:** Unite-Group (`UCxJtkvKEpNUhulVZ0suU6yw`)
- **Studio URL:** https://studio.youtube.com/channel/UCxJtkvKEpNUhulVZ0suU6yw
- **Upload workflow:** HeyGen MP4 → YouTube Studio → get video ID → link back to CCW dashboard

## Reference Files

- `apps/backend/src/config/heygen_settings.py` — default avatar/voice IDs, cost rate
- `apps/backend/src/integrations/heygen/demo_client.py` — avatar/voice catalogs
- `apps/backend/src/integrations/heygen/live_client.py` — API payload structure
