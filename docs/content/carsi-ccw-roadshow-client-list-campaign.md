# CARSI x CCW Roadshow Client-List Email Campaign

Last updated: 17 June 2026

Status: visual proof approved by Phill on 17 June 2026. Do not send through CCW CRM, SendGrid or any other email tool until CCW confirms the compliance checks below.

Campaign: CARSI x CCW Business Growth Days 2026

Primary CTA: `https://www.carsi.com.au/events/ccw-roadshow`

## Send Readiness

Required before live send:

- Confirm the CCW client-list source, export date and owner.
- Confirm consent basis for marketing email under the Australian Spam Act.
- Remove unsubscribed, bounced, suppressed and role-only addresses where required.
- Segment by location: Melbourne/Bayswater North audience and Sydney/Seven Hills audience.
- Add a working unsubscribe URL and sender postal/business footer to every email.
- Confirm sender name and address, ideally `Carpet Cleaners Warehouse` with a verified domain.
- Confirm final UTM links and the exact booking URL.
- Confirm seat capacity so "limited places" is truthful.
- Confirm no paid ads or boosted posts are enabled without separate approval.

## Suggested Segments

- Melbourne local customers: VIC contacts within practical travel range of Bayswater North.
- Sydney local customers: NSW contacts within practical travel range of Seven Hills.
- Existing carpet-cleaning product buyers.
- Equipment or chemical buyers who may benefit from training.
- Trade account holders and repeat customers.
- CARSI/CCW training enquiries, if consent allows.

## Suppression Rules

- Exclude hard bounces.
- Exclude unsubscribed contacts.
- Exclude contacts without clear marketing consent.
- Exclude contacts marked as no marketing, complaint, blocked or do not contact.
- Deduplicate by lowercase email address.
- If city is unknown, use a neutral national version only after consent is confirmed.

## Email Sequence

Use the approved copy from `/Users/phillmcgurk/CARSI/docs/marketing/ccw-roadshow-email-social-pack.md`.

Recommended sequence:

- Launch: 18-21 June.
- Value email: week of 22 June.
- Team-pack email: week of 6 July.
- City-specific final reminder: Melbourne 20-21 July; Sydney 27-29 July.

## SendGrid/CRM Gate

The current campaign should stay in draft until the CRM can prove:

- Template includes unsubscribe link.
- Template includes sender/business address.
- Segment IDs and contact counts are recorded.
- Suppression count is recorded.
- Test email is sent internally to Toby and Anne before client-list send.
- Approval status, approver and approval timestamp are captured.

## Internal Test Recipients

- Toby: `toby.b@ccwarehouse.com.au`
- Anne: `annef@ccwarehouse.com.au`

## Approval Record To Capture

- Campaign version.
- Approved proof links.
- Approved subject/preheader set.
- Approved send dates and timezone.
- Segment IDs and counts.
- Suppression count.
- Unsubscribe URL.
- Sender name and sender email.
- Approver name and timestamp.

## Not Yet Complete

- Live CCW client-list export was not accessed in this task.
- SendGrid was not used to send a campaign.
- No social platform was scheduled or posted.
- Visual approval is complete. CCW client-list compliance approval is still required before send.
