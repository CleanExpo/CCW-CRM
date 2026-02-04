"""Update Linear backlog CSV with completed tasks."""
import csv
from pathlib import Path

# Read the CSV file
csv_path = Path(__file__).parent / "docs" / "linear-import-updated-2026-01-28.csv"

with open(csv_path, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Update completed tasks to Done
updated = False
for row in rows:
    if row["Title"] == "Complete POS System Frontend UI" and not updated:
        row["Status"] = "In Progress"
        row["Description"] = '''🔄 IN PROGRESS: Completing final 5-15% of POS frontend features

**Current Assessment (via Explore Agent):**
- ✅ POS Terminal Interface: 100% Complete
- ✅ Direct Terminal Form: 100% Complete
- ✅ Staff Management CRUD: 100% Complete
- ⚠️ Location Management: 90% Complete (missing Terminal CRUD)
- ⚠️ Bank Reconciliation: 85% Complete (missing bulk actions, filters, export, bank account CRUD)

**Overall Progress: 95% Complete**

**Missing Features to Implement:**

1. **Reconciliation Dashboard (Phase 2):**
   - [ ] Bulk reconciliation actions (auto-match, bulk reconcile)
   - [ ] Advanced filters (date range, status, amount)
   - [ ] CSV export functionality
   - [ ] Bank account management CRUD

2. **Location Management (Phase 3):**
   - [ ] Terminal CRUD (create/edit/delete terminals)

**Implementation Plan:**

**Phase 1: API Client Refactoring**
- Create apps/web/lib/api/pos.ts (centralized POS API methods)
- Export typed functions for all endpoints

**Phase 2: Backend Verification**
- Verify terminal endpoints exist in pos_transactions.py
- Verify bulk reconcile + export endpoints in bank_feeds.py
- Create missing endpoints if needed

**Phase 3: Terminal Management UI**
- Create TerminalDialog.tsx component (form validation)
- Update locations/page.tsx with Terminals tab
- Table with Edit/Delete actions

**Phase 4: Reconciliation Filters**
- Create FilterPanel.tsx (date range, status, amount)
- Update reconciliation/page.tsx to apply filters
- Backend respects filter parameters

**Phase 5: Bulk Reconciliation Actions**
- Create BulkActionsPanel.tsx (checkboxes, action buttons)
- Add "Auto-Match Selected" and "Reconcile Selected"
- Confirmation dialogs for bulk operations

**Phase 6: CSV Export**
- Create ExportDialog.tsx (date range, format selection)
- Download CSV with columns: Date, Bank TX ID, POS TX ID, Amount, Status, Discrepancy
- Use browser download API

**Phase 7: Bank Account Management**
- Create BankAccountDialog.tsx (account details, BSB validation)
- Add Bank Accounts section to reconciliation page
- CRUD operations for bank accounts

**Files to Create (5 new components):**
- FilterPanel.tsx, BulkActionsPanel.tsx, ExportDialog.tsx
- BankAccountDialog.tsx, TerminalDialog.tsx

**Files to Modify (3 pages):**
- reconciliation/page.tsx, locations/page.tsx
- lib/api/pos.ts (new)

**Success Criteria:**
- [ ] Terminal CRUD functional
- [ ] Date/status/amount filters work
- [ ] Bulk auto-match within $0.10
- [ ] CSV export downloads correctly
- [ ] Bank account CRUD validates BSB format
- [ ] Type-check passes
- [ ] Lint passes
- [ ] All manual tests pass

**Estimated Effort:** 4 hours (7 phases)

**Business Value:** Complete POS system for 3 physical locations + online/phone sales

**Status:** Plan created, awaiting implementation'''
        print(f"[OK] Updated: {row['Title']} -> Status: In Progress with implementation plan")
        updated = True
    elif row["Title"] == "Setup Production Monitoring and Alerts" and row["Status"] != "Done":
        row["Status"] = "Done"
        row["Description"] = '''COMPLETE: Production monitoring and alerts fully implemented

**Completed Deliverables:**
- Backend Services (4 new files):
  - system_alert_service.py - Email/Slack notifications with rate limiting
  - business_metrics_service.py - POS, reconciliation, and order metrics
  - performance.py middleware - API performance tracking
  - alert_manager.py - Updated with resolve/notification features

- API Endpoints (3 new route files):
  - /api/monitoring/alerts - Alert management (create, list, acknowledge, resolve)
  - /api/monitoring/business/* - Business metrics (POS, reconciliation, orders)
  - /api/monitoring/performance/* - API performance (overall, slowest, errors)

- Frontend Components (3 new):
  - BusinessMetrics.tsx - POS/reconciliation/order metrics dashboard
  - AlertCard.tsx - Alert management with acknowledge/resolve
  - ApiPerformance.tsx - API response times and error rates

- Features:
  - Email notifications via SMTP (fastapi-mail)
  - Slack webhook notifications
  - Rate limiting (10 alerts/hour per type)
  - Alert deduplication (1-hour window)
  - In-memory metrics (1-hour retention)
  - Auto-refresh (15-30 seconds)
  - Status-based color coding (good/warning/critical)

**Files Changed:**
Backend:
- apps/backend/src/services/system_alert_service.py (created)
- apps/backend/src/services/business_metrics_service.py (created)
- apps/backend/src/api/middleware/performance.py (created)
- apps/backend/src/services/alert_manager.py (modified)
- apps/backend/src/api/routes/monitoring/alerts.py (created)
- apps/backend/src/api/routes/monitoring/business_metrics.py (created)
- apps/backend/src/api/routes/monitoring/performance.py (created)
- apps/backend/src/config/settings.py (added monitoring config)
- apps/backend/src/api/main.py (added middleware and routes)
- apps/backend/pyproject.toml (added fastapi-mail)

Frontend:
- apps/web/lib/api/monitoring.ts (created - 175 lines)
- apps/web/app/(dashboard)/monitoring/components/BusinessMetrics.tsx (created)
- apps/web/app/(dashboard)/monitoring/components/AlertCard.tsx (created)
- apps/web/app/(dashboard)/monitoring/components/ApiPerformance.tsx (created)
- apps/web/app/(dashboard)/monitoring/page.tsx (updated - added tabs and system alerts)

**Tests:** Type-check and lint passing

**Business Value:**
- Proactive issue detection
- Email/Slack alerts for critical issues
- Business metrics visibility (POS, reconciliation, orders)
- API performance monitoring
- Reduce downtime with early warning system

**Status:** Complete - Ready for manual testing'''
        print(f"[OK] Updated: {row['Title']} -> Status: Done")

# Write back to CSV
with open(csv_path, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"\n[OK] CSV updated: {csv_path}")

# Find next highest priority Ready task
print("\n" + "=" * 70)
print("NEXT HIGHEST PRIORITY READY TASKS")
print("=" * 70)

ready_tasks = [
    row for row in rows if row["Status"] == "Ready" and row["Priority"] in ["High", "Medium"]
]

# Sort by priority (High > Medium) and then by estimate (lower first)
priority_order = {"High": 0, "Medium": 1, "Low": 2}
ready_tasks.sort(
    key=lambda x: (priority_order.get(x["Priority"], 999), int(x["Estimate"] or 0))
)

for task in ready_tasks[:5]:  # Show top 5
    print(f"\n{task['Priority']} Priority - {task['Estimate']} points")
    print(f"  Title: {task['Title']}")
    # Show first line of description (remove emojis)
    desc_first_line = task["Description"].split("\n")[0] if task["Description"] else ""
    # Remove non-ASCII characters to avoid encoding issues
    desc_safe = desc_first_line.encode('ascii', 'ignore').decode('ascii')
    print(f"  Description: {desc_safe[:80]}...")
