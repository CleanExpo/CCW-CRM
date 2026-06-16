# CCW Phone Agent Live Readiness

This build is ready up to the point where Toby supplies the live provider keys. Until then, the phone agent can capture, triage, draft follow-ups, seed specialised agents, and show readiness, but it will not send outbound calls, enable recording, create orders, confirm paid bookings, or send campaigns.

## Toby Inputs Required

Set these environment variables in the deployment environment:

- `FEATURE_CCW_FEASIBILITY_AI_PHONE_AGENT=true`
- `FEATURE_CCW_AI_PHONE_AGENT=true`
- `FEATURE_CCW_AI_PHONE_AGENT_AFTER_HOURS=true`
- `PHONE_AGENT_PUBLIC_BASE_URL=https://<production-domain>`
- `PHONE_AGENT_OWNER_USER_ID=<app-user-uuid-for-phone-agent-records>`
- `ELEVENLABS_API_KEY=<from ElevenLabs>`
- `ELEVENLABS_AGENT_ID=<from ElevenLabs>`
- `TWILIO_ACCOUNT_SID=<from Twilio>`
- `TWILIO_AUTH_TOKEN=<from Twilio>`
- `TWILIO_PHONE_NUMBER=<Twilio number>`
- `PHONE_AGENT_WEBHOOK_SECRET=<generated strong shared secret>`

Leave these disabled until Toby explicitly approves them:

- `FEATURE_CCW_AI_PHONE_AGENT_OUTBOUND=false`
- `FEATURE_CCW_AI_PHONE_RECORDING=false`

## Provider URLs

Once `PHONE_AGENT_PUBLIC_BASE_URL` is set, the app exposes these provider endpoints:

- Twilio voice webhook: `/api/phone-agent/webhooks/twilio/voice`
- ElevenLabs conversation callback: `/api/phone-agent/webhooks/elevenlabs/conversation`

The dashboard at `/dashboard/ccw-phone-agent` shows the full URLs and missing keys.

## What Works Before Live Keys

- Manual call transcript capture from the dashboard.
- Deterministic triage into lead, sales, service, training, newsletter, company-day/event, general, or human-handoff intents.
- Draft follow-up actions only.
- Specialised agent roster seeding.
- Learning candidates from past calls.
- Company day / mini-tradeshow concept capture.
- Human-gated safety status and missing-key readiness.

## What Stays Blocked

- Live Twilio call answering until Twilio credentials, owner user id, public URL, and feature flags are set.
- ElevenLabs transcript ingestion until `PHONE_AGENT_WEBHOOK_SECRET`, owner user id, public URL, and ElevenLabs values are set.
- Outbound AI calling.
- Call recording.
- Creating orders or confirming paid bookings.
- Sending email/SMS/newsletter/social campaigns.
- Activating specialised agents without approval.

## Smoke Test Before Live

1. Open `/dashboard/ccw-phone-agent`.
2. Seed default specialised agents.
3. Paste a test transcript and click `Triage`.
4. Confirm a call appears with intent, draft follow-up count, and no sent action.
5. Confirm `Missing Live Inputs` shows only the values Toby still needs to supply.

## Webhook Security

- Twilio webhook requests are validated with `X-Twilio-Signature` and `TWILIO_AUTH_TOKEN`.
- ElevenLabs callback requests are validated with HMAC SHA-256 using `PHONE_AGENT_WEBHOOK_SECRET`.
- Local unsigned Twilio webhook testing is only allowed when `NODE_ENV !== production` and `PHONE_AGENT_ALLOW_UNSIGNED_WEBHOOKS=true`.
