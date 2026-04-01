# ADR-0007: AU Privacy Act 2024 Compliance Strategy

## Status
Accepted

## Context
The AU Privacy Act 2024 amendments remove the small business exemption in July 2026. CCW Cowork handles personal information of customers and contacts. Non-compliance carries penalties of $66K per violation.

## Decision
Implement a comprehensive compliance framework (`lib/au-privacy-compliance.js`) with:

1. **Consent Records** table: Track explicit consent per user per purpose, with version control and revocation support.

2. **AI Decision Log** table: Every AI decision that affects users is logged with reasoning, confidence score, and affected user IDs for transparency.

3. **Deletion Requests** table: User deletion requests processed within 30 days (compliance requirement).

4. **Retention Schedule** table: Automated data purge schedules per table (consent: 7 years, AI decisions: 2 years).

5. **Daily Compliance Audit**: CRON job checks overdue deletion requests, missing retention schedules, and AI decisions without reasoning.

All tables have RLS enabled. Non-compliance triggers URGENT Linear issue automatically.

## Consequences

**Easier**:
- Documented compliance posture for July 2026 deadline
- Automated daily audit reduces manual compliance overhead
- Consent tracking enables trust-based customer relationships

**Harder**:
- Every AI decision affecting users must be logged (performance overhead)
- Deletion workflows must handle cascading data across multiple tables
- Retention purge jobs must be tested carefully to avoid data loss
