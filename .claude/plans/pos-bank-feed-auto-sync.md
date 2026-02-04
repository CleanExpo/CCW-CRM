# Plan: POS Bank Feed Auto-Sync Enhancement

## Objective
Enhance the existing bank feed reconciliation system with robust auto-sync capabilities, reducing manual data entry time and improving reconciliation accuracy.

## Current State Analysis

### ✅ What Already Exists
1. **Database Models** (pos_models.py):
   - BankAccount with feed_provider integration
   - BankFeed with match_status tracking
   - POSTransaction with reconciliation_status
   - Full relationship mapping

2. **Core Services**:
   - BankFeedService: Sync from Xero/Yodlee/Basiq, auto-reconcile logic
   - BankFeedScheduler: Daily sync at 9:00 AM
   - ReconciliationAlertsService: Alert notifications

3. **Auto-Matching Algorithm**:
   - Amount matching (±10 cents tolerance)
   - Date matching (±3 days)
   - Reference number matching
   - Confidence scoring (80% threshold for auto-match)

4. **API Endpoints** (bank_feeds.py):
   - POST /api/bank-feeds/sync
   - POST /api/bank-feeds/reconcile
   - GET /api/bank-feeds/unmatched

### 🔴 What Needs Enhancement

1. **Sync Frequency**: Only daily at 9 AM - need configurable intervals
2. **Real-Time Sync**: No event-driven sync triggers
3. **Matching Intelligence**: Basic algorithm - could use ML/AI for better matches
4. **Dashboard**: No visual reconciliation dashboard
5. **Bulk Operations**: No bulk manual reconciliation UI
6. **Provider Coverage**: Yodlee and Basiq are TODO stubs
7. **Error Recovery**: Limited retry logic for failed syncs
8. **Monitoring**: Basic metrics - need comprehensive observability

## Implementation Plan

### Phase 1: Enhanced Scheduler & Real-Time Sync (4 hours)

**Goal**: Add configurable sync intervals and webhook support

**Tasks**:

1. **Configurable Sync Intervals** (1.5 hours)
   - Add settings for sync frequency (hourly, every 4 hours, daily)
   - Store sync schedule per bank account
   - Update BankAccount model with `sync_interval_hours` field
   - Modify scheduler to respect per-account intervals

2. **Webhook Support for Real-Time Sync** (2 hours)
   - Create webhook endpoint for bank feed providers
   - Handle Xero webhook notifications
   - Trigger immediate sync on webhook receipt
   - Secure webhook with HMAC signature verification

3. **Manual Trigger Improvements** (0.5 hours)
   - Add "Sync Now" button in UI
   - Show last sync time and next scheduled sync
   - Display sync progress indicator

**Files to Create/Modify**:
- `apps/backend/src/db/pos_models.py` - Add sync_interval_hours field
- `apps/backend/src/scheduler/bank_feed_scheduler.py` - Dynamic intervals
- `apps/backend/src/api/routes/bank_feeds.py` - Add webhook endpoint
- `apps/backend/src/api/routes/bank_feeds.py` - Enhance manual sync

**Success Criteria**:
- ✅ Accounts can be set to sync hourly, every 4 hours, or daily
- ✅ Webhook triggers immediate sync
- ✅ Manual "Sync Now" works from UI
- ✅ Tests pass for new scheduler logic

---

### Phase 2: Improved Matching Algorithm (3 hours)

**Goal**: Enhance auto-matching with AI-powered fuzzy matching

**Tasks**:

1. **Enhanced Fuzzy Matching** (1.5 hours)
   - Add fuzzy string matching for descriptions
   - Use Levenshtein distance for reference comparison
   - Handle common bank description patterns (EFTPOS, POS, etc.)
   - Improve confidence scoring algorithm

2. **AI-Powered Suggestion** (1 hour)
   - Use existing AI agents to suggest matches for low-confidence items
   - Add match_suggestions JSONB field to BankFeed
   - Rank suggestions by confidence
   - Present top 3 suggestions in UI

3. **Learning from Manual Matches** (0.5 hours)
   - Track manual match patterns
   - Adjust confidence weights based on historical accuracy
   - Store match patterns in database for future reference

**Files to Create/Modify**:
- `apps/backend/src/services/bank_feed_service.py` - Enhanced matching
- `apps/backend/src/ai/agents/specialized/reconciliation_agent.py` - NEW
- `apps/backend/src/db/pos_models.py` - Add match_suggestions field

**Success Criteria**:
- ✅ Fuzzy matching increases auto-match rate by 15%+
- ✅ AI suggestions available for manual review
- ✅ Confidence scoring improves over time with learning
- ✅ Tests pass for new matching logic

---

### Phase 3: Reconciliation Dashboard (3 hours)

**Goal**: Build visual dashboard for reconciliation oversight

**Tasks**:

1. **Backend API Endpoints** (1 hour)
   - GET /api/reconciliation/dashboard - Summary statistics
   - GET /api/reconciliation/pending - Pending matches with suggestions
   - POST /api/reconciliation/bulk-approve - Bulk approve suggestions

2. **Frontend Dashboard Components** (2 hours)
   - Reconciliation status cards (matched, pending, discrepancy)
   - Timeline chart showing sync history
   - Pending matches table with suggestion cards
   - Bulk actions (approve all, reject, manual match)
   - Search and filter by date range, amount, status

**Files to Create**:
- `apps/backend/src/api/routes/reconciliation_dashboard.py` - NEW
- `apps/web/app/(dashboard)/reconciliation/page.tsx` - NEW
- `apps/web/app/(dashboard)/reconciliation/components/ReconciliationDashboard.tsx` - NEW
- `apps/web/app/(dashboard)/reconciliation/components/PendingMatchesTable.tsx` - NEW
- `apps/web/app/(dashboard)/reconciliation/components/SuggestionCard.tsx` - NEW

**Success Criteria**:
- ✅ Dashboard shows real-time reconciliation status
- ✅ Pending matches display with AI suggestions
- ✅ Bulk approval workflow works smoothly
- ✅ UI is responsive and intuitive
- ✅ Tests pass for dashboard endpoints

---

### Phase 4: Monitoring & Alerting (1.5 hours)

**Goal**: Comprehensive observability for sync health

**Tasks**:

1. **Enhanced Metrics** (0.5 hours)
   - Track sync success/failure rate per provider
   - Track auto-match rate and confidence distribution
   - Track manual intervention rate
   - Track time from bank transaction to reconciliation

2. **Alerting Rules** (0.5 hours)
   - Alert if sync fails 3 times in a row
   - Alert if auto-match rate drops below 60%
   - Alert for large unmatched amounts (>$1000)
   - Alert for reconciliation delays (>48 hours)

3. **Grafana Dashboard** (0.5 hours)
   - Add reconciliation panel to existing Business Metrics dashboard
   - Chart: Auto-match rate over time
   - Chart: Sync frequency and success rate
   - Table: Unmatched transactions (top 10 by amount)

**Files to Modify**:
- `apps/backend/src/monitoring/metrics.py` - Add reconciliation metrics
- `monitoring/grafana/dashboards/business_metrics.json` - Add panels
- `monitoring/alertmanager/rules/reconciliation_alerts.yml` - NEW

**Success Criteria**:
- ✅ Metrics exposed in /metrics endpoint
- ✅ Grafana dashboard shows reconciliation health
- ✅ Alerts fire correctly for failure scenarios
- ✅ Prometheus scrapes new metrics

---

### Phase 5: Error Recovery & Resilience (1 hour)

**Goal**: Handle failures gracefully with retry logic

**Tasks**:

1. **Exponential Backoff Retry** (0.5 hours)
   - Retry failed syncs with exponential backoff
   - Maximum 3 retries per sync attempt
   - Track retry count in BankAccount.feed_sync_status

2. **Partial Sync Recovery** (0.5 hours)
   - If sync fails mid-way, save partial results
   - Resume from last successful transaction
   - Prevent duplicate transactions on retry

**Files to Modify**:
- `apps/backend/src/services/bank_feed_service.py` - Add retry logic
- `apps/backend/src/scheduler/bank_feed_scheduler.py` - Handle retries

**Success Criteria**:
- ✅ Failed syncs automatically retry up to 3 times
- ✅ Partial syncs don't lose data
- ✅ No duplicate transactions created on retry
- ✅ Tests pass for retry scenarios

---

## Database Migrations Required

### Migration 1: Add Sync Configuration Fields
```sql
ALTER TABLE bank_accounts
ADD COLUMN sync_interval_hours INTEGER DEFAULT 24,
ADD COLUMN webhook_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN webhook_secret VARCHAR(200);

ALTER TABLE bank_feeds
ADD COLUMN match_suggestions JSONB;
```

### Migration 2: Add Retry Tracking
```sql
ALTER TABLE bank_accounts
ADD COLUMN sync_retry_count INTEGER DEFAULT 0,
ADD COLUMN last_sync_error TEXT;
```

**File to Create**:
- `apps/backend/migrations/add_auto_sync_enhancements.py`

---

## Testing Strategy

### Unit Tests
- Enhanced matching algorithm accuracy
- Confidence scoring with edge cases
- Retry logic with mocked failures
- Webhook signature verification

### Integration Tests
- Full sync workflow (Xero mock → DB → auto-match)
- Webhook endpoint trigger → sync → reconcile
- Bulk approval workflow
- Dashboard API responses

### E2E Tests
- User triggers manual sync from UI
- User approves suggested matches
- User views reconciliation dashboard

---

## Success Metrics

### Before Enhancement
- Auto-match rate: ~65-70% (estimated from current algorithm)
- Manual intervention: 30-35% of transactions
- Sync frequency: Daily (once per day)
- Average time to reconciliation: 24-48 hours

### After Enhancement (Target)
- Auto-match rate: **85%+** (15% improvement)
- Manual intervention: **<20%** (10-15% reduction)
- Sync frequency: **Configurable** (hourly to daily)
- Average time to reconciliation: **<12 hours** (50% improvement)

---

## Risks & Mitigation

### Risk 1: Increased API Costs
- **Impact**: More frequent syncs = more API calls to Xero/Yodlee
- **Mitigation**: Make hourly sync opt-in, default to 4-hour intervals
- **Fallback**: Rate limit syncs to prevent excessive calls

### Risk 2: False Positive Auto-Matches
- **Impact**: Incorrect matches cause accounting errors
- **Mitigation**: Keep 80% confidence threshold, require manual approval for 60-80%
- **Monitoring**: Track manual override rate

### Risk 3: Webhook Security
- **Impact**: Unauthorized webhook triggers could pollute data
- **Mitigation**: HMAC signature verification, rate limiting
- **Testing**: Penetration test webhook endpoint

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Enhanced Scheduler | 4 hours | None |
| Phase 2: Improved Matching | 3 hours | Phase 1 (optional) |
| Phase 3: Dashboard | 3 hours | Phase 2 (for suggestions) |
| Phase 4: Monitoring | 1.5 hours | Phase 1-3 |
| Phase 5: Error Recovery | 1 hour | Phase 1 |
| **Total** | **12.5 hours** | |

**Recommended Approach**: Implement Phases 1-2 first (7 hours), validate auto-match improvement, then proceed with dashboard and monitoring.

---

## Breaking Changes

**None** - All enhancements are backward compatible:
- New fields have defaults
- Existing sync schedule (9 AM daily) remains unless changed
- Existing API endpoints unchanged
- New endpoints are additive

---

## Next Steps After Approval

1. Create database migration file
2. Implement Phase 1 (Enhanced Scheduler)
3. Test with Xero demo mode
4. Implement Phase 2 (Improved Matching)
5. Measure auto-match rate improvement
6. Implement Phase 3-5 if Phases 1-2 successful
7. Deploy to staging
8. Monitor metrics for 1 week
9. Deploy to production

---

**Estimated Total Effort**: 12-15 hours
**Impact**: 15%+ improvement in auto-match rate, <12 hour reconciliation time
**Priority**: P1-1 HIGH (from Phase 5 Week 4 plan)
