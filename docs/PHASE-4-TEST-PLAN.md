# Phase 4 Real-Time Infrastructure - Test Plan

**Date:** February 3, 2026
**Phase:** 4 - Real-Time Infrastructure
**Status:** Ready for Testing

---

## 🎯 Test Objectives

Verify all Phase 4 real-time features work correctly:
1. ✅ Real-time inventory SSE stream
2. ✅ Order status push notifications
3. ✅ POS failure alerts
4. ✅ Dashboard metrics SSE
5. ✅ Timestamp displays

---

## 📋 Pre-Test Setup

### 1. Start Services

```bash
# Terminal 1 - Backend
cd apps/backend
uv run uvicorn src.api.main:app --reload

# Terminal 2 - Frontend
cd apps/web
pnpm dev

# Terminal 3 - Database (if not running)
docker compose up -d
```

### 2. Verify Services Running

```bash
# Check backend
curl http://localhost:8000/api/health

# Check frontend
curl http://localhost:3000/api/health

# Expected: Both return 200 OK
```

---

## 🧪 Test Suite 1: Real-Time Inventory

**Feature:** Live stock updates via SSE
**Endpoint:** `/api/inventory-stream`
**Hook:** `useInventoryStream()`

### Manual Test Steps

1. **Open Products Page**
   - Navigate to http://localhost:3000/products
   - Verify "Live" indicator badge shows in header
   - Note current stock levels

2. **Trigger Stock Change**
   - Open product edit dialog
   - Click "Transfer Stock" button
   - Transfer 5 units from Brisbane → Sydney
   - Submit transfer

3. **Verify Real-Time Update**
   - ✅ Stock levels update WITHOUT page refresh
   - ✅ Multi-location stock cell shows new values
   - ✅ Update happens within 1 second
   - ✅ No console errors

### Automated Test (Backend)

```bash
# Test SSE endpoint connectivity
cd apps/backend
curl -N http://localhost:8000/api/inventory-stream

# Expected: SSE connection established
# Output: event: connected
#         data: {"client_id": "...", "channel": "inventory-updates"}
```

### Success Criteria
- [x] SSE connection established
- [x] Stock changes trigger events
- [x] Frontend updates automatically
- [x] No page refresh required

---

## 🧪 Test Suite 2: Order Status Push Notifications

**Feature:** Live order status updates
**Endpoint:** `/api/orders/status-stream`
**Hook:** `useOrderStatusStream()`

### Manual Test Steps

1. **Open Order Detail Dialog**
   - Navigate to http://localhost:3000/orders
   - Click "View Details" on any order
   - Verify "Live" badge appears in dialog header

2. **Trigger Status Change**
   - Open order in second browser window/tab
   - Change status from "pending" → "confirmed"
   - Save changes

3. **Verify Real-Time Update**
   - ✅ First window shows status update WITHOUT refresh
   - ✅ Toast notification appears: "Order Updated"
   - ✅ Status badge updates automatically
   - ✅ Activity timeline shows new entry

### Automated Test (Backend)

```bash
# Test SSE endpoint connectivity
curl -N http://localhost:8000/api/orders/status-stream

# Expected: SSE connection established
# Output: event: connected
#         data: {"client_id": "...", "channel": "order-updates"}
```

### Success Criteria
- [x] SSE connection established
- [x] Status changes emit events
- [x] Toast notifications appear
- [x] UI updates in real-time

---

## 🧪 Test Suite 3: POS Failure Alerts

**Feature:** Instant POS payment failure detection
**Endpoint:** `/api/monitoring/alerts/pos-failures/stream`
**Hook:** `usePOSFailureAlerts()`

### Manual Test Steps

1. **Open Dashboard**
   - Navigate to http://localhost:3000/dashboard
   - Note current POS failure count (should be 0 or low)

2. **Simulate POS Failure**
   - Navigate to http://localhost:3000/pos/terminal
   - Process a payment with invalid card details
   - OR: Trigger failure via API:

   ```bash
   curl -X POST http://localhost:8000/api/pos/transactions \
     -H "Content-Type: application/json" \
     -d '{
       "amount": 100,
       "payment_method": "eftpos",
       "terminal_id": "invalid-terminal-id"
     }'
   ```

3. **Verify Real-Time Alert**
   - ✅ Dashboard shows alert badge within 5 seconds
   - ✅ Toast notification appears: "POS Payment Failed"
   - ✅ Alert badge shows failure count
   - ✅ "Live" indicator shows connection active

### Automated Test (Backend)

```bash
# Test SSE endpoint connectivity
curl -N http://localhost:8000/api/monitoring/alerts/pos-failures/stream

# Expected: SSE connection established
# Output: event: connected
#         data: {"client_id": "...", "channel": "pos-failures"}
```

### Automated Test (Check Failures)

```bash
# Check current POS failures (last 24h)
curl http://localhost:8000/api/monitoring/alerts/pos-failures?hours=24

# Expected: JSON with alert_count and failures array
```

### Success Criteria
- [x] SSE connection established
- [x] POS failures detected instantly
- [x] Dashboard badge updates
- [x] Toast notification appears

---

## 🧪 Test Suite 4: Dashboard Live Metrics

**Feature:** Real-time dashboard metrics without polling
**Endpoint:** `/api/dashboard/metrics-stream`
**Hook:** `useDashboardMetricsStream()`

### Manual Test Steps

1. **Open Dashboard**
   - Navigate to http://localhost:3000/dashboard
   - Verify "Live Metrics" badge with green pulse animation
   - Note current metrics (revenue, active orders, etc.)

2. **Trigger Metric Change - Orders**
   - Open second browser window
   - Navigate to http://localhost:3000/orders
   - Create a new order
   - Submit order

3. **Verify Real-Time Update**
   - ✅ First window dashboard updates WITHOUT refresh
   - ✅ "Active Orders" count increments
   - ✅ Update happens within 500ms-1s
   - ✅ Recent activity shows new order

4. **Trigger Metric Change - Products**
   - Create a new product in second window
   - ✅ "Total Products" count increments in first window
   - ✅ No page refresh required

### Automated Test (Backend)

```bash
# Test SSE endpoint connectivity
curl -N http://localhost:8000/api/dashboard/metrics-stream

# Expected: SSE connection established
# Output: event: connected
#         data: {"client_id": "...", "channel": "dashboard-metrics"}
```

### Success Criteria
- [x] SSE connection established
- [x] Metrics update on order creation
- [x] Metrics update on product creation
- [x] Auto-refresh within 500ms
- [x] No polling overhead

---

## 🧪 Test Suite 5: Timestamp Displays

**Feature:** "Updated X ago" on all list pages
**Pages:** Products, Orders, Quotes, Customers, Purchase Orders

### Manual Test Steps

1. **Test Each Page**
   - Navigate to each page:
     - http://localhost:3000/products
     - http://localhost:3000/orders
     - http://localhost:3000/quotes
     - http://localhost:3000/customers
     - http://localhost:3000/purchase-orders

2. **Verify Timestamp Display**
   - ✅ Each page shows "Updated X ago" in description
   - ✅ Format: "• Updated 2 seconds ago" or "• Updated 5 minutes ago"
   - ✅ Timestamp updates after page refresh
   - ✅ Uses relative time (not absolute timestamp)

### Success Criteria
- [x] All 5 pages show timestamps
- [x] Format is consistent
- [x] Time is relative ("X ago")
- [x] Updates on refresh

---

## 🔍 Integration Tests

### Test Cross-Feature Integration

1. **Multi-Tab Consistency**
   - Open dashboard in 2 browser tabs
   - Create order in Tab 1
   - ✅ Tab 2 dashboard updates automatically
   - ✅ Both tabs show same data after update

2. **SSE Reconnection**
   - Open products page
   - Stop backend (Ctrl+C)
   - ✅ "Live" indicator disappears or shows "disconnected"
   - Restart backend
   - ✅ "Live" indicator reappears (auto-reconnect)
   - ✅ Updates resume working

3. **Multiple SSE Streams**
   - Open dashboard (3 SSE streams: metrics, POS, inventory)
   - ✅ All 3 streams connect successfully
   - ✅ No connection conflicts
   - ✅ All streams receive events independently

---

## 📊 Performance Tests

### SSE Connection Health

```bash
# Monitor active SSE connections
curl http://localhost:8000/api/sse/stats

# Expected output:
{
  "total_connections": 15,
  "active_connections": 15,
  "events_published": 142,
  "channels": {
    "inventory-updates": 3,
    "order-updates": 2,
    "pos-failures": 5,
    "dashboard-metrics": 5
  }
}
```

### Network Performance

1. **Check Browser DevTools**
   - Open Network tab
   - Filter: EventSource
   - ✅ SSE connections show "pending" (kept alive)
   - ✅ No excessive reconnection attempts
   - ✅ Heartbeat pings every 15-30 seconds

2. **Check Backend Logs**
   - Look for SSE connection messages
   - ✅ No excessive "client disconnected" messages
   - ✅ Clean reconnection after network hiccups

---

## 🐛 Error Handling Tests

### 1. Network Interruption
- Disconnect WiFi mid-session
- ✅ SSE status changes to "disconnected"
- Reconnect WiFi
- ✅ SSE auto-reconnects within 3-5 seconds

### 2. Backend Restart
- Stop backend while frontend open
- ✅ Frontend shows disconnected state
- Start backend
- ✅ Frontend reconnects automatically

### 3. Malformed Events
- Backend emits invalid JSON
- ✅ Frontend logs error but doesn't crash
- ✅ Connection remains stable

---

## ✅ Test Sign-Off Checklist

### Backend Tests
- [ ] All SSE endpoints respond (4/4)
- [ ] Events published on data changes
- [ ] SSE service stats show connections
- [ ] No memory leaks (long-running test)
- [ ] Graceful cleanup on disconnect

### Frontend Tests
- [ ] All hooks establish SSE connections
- [ ] Real-time updates work (no refresh)
- [ ] Toast notifications appear
- [ ] Visual indicators show connection status
- [ ] Timestamps display on all pages (5/5)

### Integration Tests
- [ ] Multi-tab consistency works
- [ ] Auto-reconnection works
- [ ] Multiple streams coexist
- [ ] No connection conflicts

### Performance Tests
- [ ] SSE latency <1 second
- [ ] No excessive API calls
- [ ] Memory stable over time
- [ ] CPU usage reasonable

### Error Handling Tests
- [ ] Network interruption handled
- [ ] Backend restart handled
- [ ] Malformed events handled

---

## 🚨 Known Issues & Limitations

1. **SSE vs WebSocket**
   - Current: Server-Sent Events (one-way)
   - Future: Consider WebSocket for two-way communication

2. **Browser Compatibility**
   - EventSource not supported in IE11
   - Polyfill may be needed for older browsers

3. **Scaling Considerations**
   - Current: In-memory event queues
   - Production: Should use Redis Pub/Sub

---

## 📝 Test Execution Log

**Date:** _____________
**Tester:** _____________
**Environment:** Development / Staging / Production

| Test Suite | Status | Notes |
|------------|--------|-------|
| Real-Time Inventory | ⬜ Pass / ⬜ Fail | |
| Order Status Push | ⬜ Pass / ⬜ Fail | |
| POS Failure Alerts | ⬜ Pass / ⬜ Fail | |
| Dashboard Metrics | ⬜ Pass / ⬜ Fail | |
| Timestamp Displays | ⬜ Pass / ⬜ Fail | |
| Integration Tests | ⬜ Pass / ⬜ Fail | |
| Performance Tests | ⬜ Pass / ⬜ Fail | |
| Error Handling | ⬜ Pass / ⬜ Fail | |

**Overall Result:** ⬜ PASS / ⬜ FAIL
**Sign-Off:** _____________
**Date:** _____________

---

## 🎯 Next Steps After Testing

If tests pass:
- ✅ Deploy to staging environment
- ✅ Run tests again in staging
- ✅ Monitor SSE performance in staging
- ✅ Plan production rollout

If tests fail:
- ❌ Document failures in GitHub issues
- ❌ Fix issues and re-test
- ❌ Update test plan if needed

---

**End of Test Plan**
