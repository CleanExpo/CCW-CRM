# Week 5: Real-Time UI Integration - Implementation Guide

Complete guide for integrating WebSocket real-time updates into the CCW-Online ERP UI.

---

## Progress Summary

### ✅ Completed

1. **WebSocket Provider & Context** - Global WebSocket management
2. **Connection Status Indicator** - Visual WebSocket status component
3. **Real-Time Hooks** - Reusable hooks for entities (orders, inventory)

### 🚧 In Progress

4. **Page Integration** - Adding real-time updates to Orders, Dashboard, etc.
5. **Advanced Search** - Multi-criteria filtering with saved filters
6. **Bulk Operations** - Multi-select with bulk actions
7. **Keyboard Shortcuts** - Command palette and hotkeys

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                 App Layout (Root)                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │         WebSocketProvider                          │  │
│  │  - Manages global WebSocket connection            │  │
│  │  - Auto-reconnects with exponential backoff       │  │
│  │  - Subscribes to 'notifications' channel globally │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                                │
│       ┌─────────────────┼─────────────────┐              │
│       ▼                 ▼                 ▼              │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐           │
│  │  Orders │     │Dashboard│     │Inventory│           │
│  │  Page   │     │  Page   │     │  Page   │           │
│  └────┬────┘     └────┬────┘     └────┬────┘           │
│       │               │               │                 │
│       │ useRealTime   │ useRealTime   │ useRealTime     │
│       │ Orders        │ Dashboard     │ Inventory       │
│       ▼               ▼               ▼                 │
│  Subscribes to    Subscribes to   Subscribes to        │
│  'orders'         multiple         'inventory'          │
│  channel          channels         channel              │
└─────────────────────────────────────────────────────────┘
```

---

## 1. WebSocket Provider

### File: `apps/web/contexts/websocket-context.tsx`

**Purpose**: Provides global WebSocket connection management.

**Features:**
- ✅ Auto-connection on mount
- ✅ Client ID generation and persistence
- ✅ Global notification subscription
- ✅ Connection state tracking
- ✅ Toast notifications for connection changes

**Usage in Root Layout:**

```tsx
// app/layout.tsx or app/(dashboard)/layout.tsx
import { WebSocketProvider } from "@/contexts/websocket-context";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </body>
    </html>
  );
}
```

**How It Works:**

1. **Client ID Generation:**
   - Generates unique client ID on first visit
   - Stores in `localStorage` as `ws_client_id`
   - Reuses same ID on subsequent visits

2. **Auto-Connection:**
   - Connects to `ws://localhost:8000/ws/{client_id}` automatically
   - Reconnects with exponential backoff on disconnection
   - Max 10 reconnect attempts before giving up

3. **Global Notifications:**
   - Automatically subscribes to `notifications` channel
   - Displays system-wide notifications as toasts
   - Shows connection status changes

**Accessing WebSocket in Components:**

```tsx
import { useWebSocketContext } from "@/contexts/websocket-context";

function MyComponent() {
  const { subscribe, unsubscribe, connectionState } = useWebSocketContext();

  useEffect(() => {
    const handler = (message) => console.log(message);
    subscribe('orders', handler);
    return () => unsubscribe('orders');
  }, []);

  return <div>Status: {connectionState}</div>;
}
```

---

## 2. Connection Status Indicator

### File: `apps/web/components/websocket-status.tsx`

**Purpose**: Visual indicator showing WebSocket connection state.

**Features:**
- ✅ 4 states: connected, connecting, disconnected, error
- ✅ Color-coded (green, yellow, gray, red)
- ✅ Animated pulse for connecting state
- ✅ Tooltip with detailed status
- ✅ Compact and labeled modes
- ✅ 3 size variants (sm, md, lg)

**Usage:**

```tsx
import { WebSocketStatus } from "@/components/websocket-status";

// Compact mode (just dot)
<WebSocketStatus size="sm" />

// With label
<WebSocketStatus showLabel size="md" />

// In navbar
<nav className="flex items-center gap-4">
  <WebSocketStatus showLabel size="sm" />
  {/* Other nav items */}
</nav>
```

**States:**

| State | Color | Icon | Meaning |
|-------|-------|------|---------|
| `connected` | Green | Wifi | Real-time updates active |
| `connecting` | Yellow | Loader2 (spinning) | Establishing connection |
| `disconnected` | Gray | WifiOff | Connection paused |
| `error` | Red | AlertCircle | Connection failed |

**Where to Add:**

1. **Navbar**: Show in top right corner
2. **Footer**: Show in footer for always-visible status
3. **Settings Page**: Show detailed connection info

---

## 3. Real-Time Entity Hooks

### Orders Hook: `use-real-time-orders.ts`

**Purpose**: Subscribe to order updates and handle them automatically.

**Features:**
- ✅ Subscribes to `orders` channel
- ✅ Auto-refreshes page on updates
- ✅ Callbacks for each action type
- ✅ Optional toast notifications
- ✅ Handles: created, updated, status_changed, deleted

**Usage:**

```tsx
import { useRealTimeOrders } from "@/hooks/use-real-time-orders";

function OrdersPage() {
  useRealTimeOrders({
    showNotifications: true,
    onOrderCreated: (order) => {
      console.log('New order:', order);
      // Optionally update local state instead of refresh
    },
    onOrderStatusChanged: (order) => {
      console.log('Status changed:', order.status);
    },
  });

  return <div>Orders list will auto-update</div>;
}
```

**How It Works:**

1. Connects to `orders` channel via WebSocket
2. Listens for `order_update` messages
3. Calls `router.refresh()` to re-fetch server data
4. Triggers appropriate callback based on `action`
5. Shows toast notification (if enabled)

**Benefits:**
- ✨ Multiple users see order updates instantly
- ✨ No manual refresh needed
- ✨ Clean separation of concerns

---

### Inventory Hook: `use-real-time-inventory.ts`

**Purpose**: Subscribe to inventory stock level updates.

**Usage:**

```tsx
import { useRealTimeInventory } from "@/hooks/use-real-time-inventory";

function InventoryPage() {
  useRealTimeInventory({
    showNotifications: false, // Don't spam user
    onInventoryUpdate: (update) => {
      console.log(`Stock updated: ${update.data.available} available`);
    },
  });

  return <div>Inventory page</div>;
}
```

---

## 4. Integration into Pages

### Step-by-Step: Orders Page Integration

**1. Add WebSocketProvider to Layout** (if not already done):

```tsx
// app/(dashboard)/layout.tsx
import { WebSocketProvider } from "@/contexts/websocket-context";

export default function DashboardLayout({ children }) {
  return (
    <WebSocketProvider>
      <div>
        <Navbar />
        {children}
      </div>
    </WebSocketProvider>
  );
}
```

**2. Add Connection Status to Navbar:**

```tsx
// components/navbar.tsx
import { WebSocketStatus } from "@/components/websocket-status";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-3">
      <div>Logo</div>
      <div className="flex items-center gap-4">
        <WebSocketStatus showLabel size="sm" />
        <UserMenu />
      </div>
    </nav>
  );
}
```

**3. Add Real-Time Hook to Orders Page:**

```tsx
// app/(dashboard)/orders/page.tsx
"use client"; // Make sure it's a client component

import { useRealTimeOrders } from "@/hooks/use-real-time-orders";

export default function OrdersPage() {
  // Enable real-time updates
  useRealTimeOrders({
    showNotifications: true,
  });

  // Rest of your existing code
  return (
    <div>
      {/* Your orders list */}
    </div>
  );
}
```

**4. Test Real-Time Updates:**

```bash
# Terminal 1: Start backend
cd apps/backend
uvicorn src.api.main:app --reload

# Terminal 2: Start frontend
cd apps/web
npm run dev

# Terminal 3: Simulate order creation
curl -X POST http://localhost:8000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "...", "items": [...]}'
```

✨ **Result**: Orders page should auto-refresh and show toast notification!

---

### Broadcasting from Backend

To send real-time updates from your API routes:

```python
# apps/backend/src/api/routes/orders.py
from fastapi import APIRouter
from src.websockets.events import broadcast_order_update

router = APIRouter()

@router.post("/api/orders")
async def create_order(order_data: OrderCreate, db: AsyncSession = Depends(get_db)):
    # Create order in database
    new_order = await create_order_in_db(db, order_data)

    # 🚀 Broadcast to WebSocket clients
    await broadcast_order_update(
        order_id=new_order.id,
        action="created",
        data={
            "id": new_order.id,
            "order_number": new_order.order_number,
            "customer_name": new_order.customer_name,
            "total": str(new_order.total),
            "status": new_order.status,
        }
    )

    return new_order


@router.patch("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: str,
    db: AsyncSession = Depends(get_db)
):
    # Update in database
    updated_order = await update_status_in_db(db, order_id, status)

    # 🚀 Broadcast status change
    await broadcast_order_update(
        order_id=order_id,
        action="status_changed",
        data={
            "id": order_id,
            "order_number": updated_order.order_number,
            "status": status,
        }
    )

    return updated_order
```

---

## 5. Advanced Features (To Implement)

### A. Advanced Search & Filtering

**Goal**: Multi-criteria search with saved filters.

**Features to Add:**
- Filter by multiple fields (status, date range, customer)
- Save frequently used filters to localStorage
- Quick filters (e.g., "Orders this week", "Overdue orders")
- Search suggestions as you type

**Component Structure:**
```tsx
<AdvancedSearchBar
  filters={[
    { field: 'status', operator: 'equals', value: 'pending' },
    { field: 'created_at', operator: 'after', value: '2026-01-01' },
  ]}
  onFiltersChange={(filters) => applyFilters(filters)}
  savedFilters={getSavedFilters()}
  onSaveFilter={(name, filters) => saveFilter(name, filters)}
/>
```

---

### B. Bulk Operations

**Goal**: Select multiple records for bulk actions.

**Features to Add:**
- Checkbox selection on list views
- "Select All" functionality
- Bulk delete with confirmation
- Bulk status update
- Bulk export

**Example Implementation:**

```tsx
function OrdersList() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectAll = () => {
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map(o => o.id));
    }
  };

  const handleBulkDelete = async () => {
    await apiClient.delete('/api/orders/bulk', {
      data: { ids: selectedIds }
    });
    setSelectedIds([]);
    router.refresh();
  };

  return (
    <div>
      {selectedIds.length > 0 && (
        <BulkActionsToolbar
          count={selectedIds.length}
          onDelete={handleBulkDelete}
          onExport={() => exportOrders(selectedIds)}
        />
      )}

      <Table>
        <TableHeader>
          <Checkbox checked={selectedIds.length === orders.length} onChange={handleSelectAll} />
          {/* Other headers */}
        </TableHeader>
        <TableBody>
          {orders.map(order => (
            <TableRow key={order.id}>
              <Checkbox
                checked={selectedIds.includes(order.id)}
                onChange={() => toggleSelection(order.id)}
              />
              {/* Other cells */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

### C. Keyboard Shortcuts

**Goal**: Power user keyboard shortcuts for common actions.

**Shortcuts to Implement:**

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open command palette |
| `G → O` | Go to Orders |
| `G → P` | Go to Products |
| `G → C` | Go to Customers |
| `C` | Create new (context-aware) |
| `/` | Focus search |
| `Esc` | Close dialog/modal |
| `?` | Show keyboard shortcuts help |

**Implementation:**

```tsx
// hooks/use-keyboard-shortcuts.ts
import { useEffect } from 'react';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Command palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
      }

      // Go to shortcuts: G → O, G → P, etc.
      if (e.key === 'g') {
        // Wait for next key
        window.addEventListener('keydown', handleGoShortcut, { once: true });
      }

      // Create new: C
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
        createNew();
      }

      // Focus search: /
      if (e.key === '/') {
        e.preventDefault();
        focusSearch();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
```

**Command Palette Component:**

```tsx
// components/command-palette.tsx
import { Command } from 'cmdk';

export function CommandPalette({ open, onClose }) {
  return (
    <Command.Dialog open={open} onOpenChange={onClose}>
      <Command.Input placeholder="Type a command or search..." />
      <Command.List>
        <Command.Group heading="Navigation">
          <Command.Item onSelect={() => router.push('/orders')}>
            Go to Orders
          </Command.Item>
          <Command.Item onSelect={() => router.push('/products')}>
            Go to Products
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Actions">
          <Command.Item onSelect={() => openCreateOrderDialog()}>
            Create New Order
          </Command.Item>
          <Command.Item onSelect={() => openCreateProductDialog()}>
            Create New Product
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

---

## 6. Next Steps

### Immediate Tasks

1. **✅ Done**: WebSocket Provider
2. **✅ Done**: Connection Status Indicator
3. **✅ Done**: Real-Time Hooks

4. **🚧 In Progress**:
   - [ ] Add WebSocketProvider to root layout
   - [ ] Add connection status to navbar
   - [ ] Integrate real-time hook into Orders page
   - [ ] Integrate real-time hook into Dashboard
   - [ ] Test real-time updates end-to-end

5. **📋 Todo**:
   - [ ] Implement advanced search component
   - [ ] Add bulk operations UI
   - [ ] Implement keyboard shortcuts
   - [ ] Add command palette
   - [ ] Create keyboard shortcuts help dialog

### Week 6 Preview

Next week focuses on **Agent Autonomy**:
- Configure autonomy levels (Advisory, Semi-Autonomous, Fully Autonomous)
- Implement auto-execution logic with confidence thresholds
- Add learning feedback loops for agent decisions
- Create agent performance dashboard

---

## 7. Testing Checklist

### Manual Testing

**WebSocket Connection:**
- [ ] Open app → WebSocket connects automatically
- [ ] See green "Connected" indicator
- [ ] Refresh page → Reconnects automatically
- [ ] Stop backend → Shows "Disconnected" or "Error"
- [ ] Restart backend → Reconnects within 30 seconds

**Real-Time Updates (Orders):**
- [ ] Open Orders page
- [ ] Create order via API/Postman
- [ ] Orders page refreshes automatically
- [ ] Toast notification appears
- [ ] New order visible in list

**Multi-User Sync:**
- [ ] Open Orders page in 2 browser tabs
- [ ] Create order in Tab 1
- [ ] Tab 2 updates automatically
- [ ] Both tabs show same data

**Notifications:**
- [ ] Send notification via API
- [ ] Toast appears with correct title/message
- [ ] Severity colors work (info, warning, error)
- [ ] Action URL navigation works

### Integration Testing

```typescript
// Example test
describe('Real-Time Orders', () => {
  it('updates orders list when order is created', async () => {
    render(<OrdersPage />);

    // Simulate WebSocket message
    act(() => {
      triggerWebSocketMessage({
        type: 'order_update',
        action: 'created',
        order_id: '123',
        data: { order_number: 'ORD-001' }
      });
    });

    // Verify toast shown
    expect(screen.getByText(/Order ORD-001/)).toBeInTheDocument();
  });
});
```

---

## 8. Troubleshooting

### Issue: WebSocket Not Connecting

**Symptoms**: Status shows "Disconnected" or "Error"

**Checklist**:
1. ✅ Backend running? `curl http://localhost:8000/health`
2. ✅ Redis running? `docker ps | grep redis`
3. ✅ Correct WebSocket URL? Check browser console
4. ✅ CORS configured? Check `settings.cors_origins`

**Solution**:
```typescript
// Check browser console for errors
// Should see: "WebSocket connected" in logs

// If not, verify backend WebSocket endpoint
// Test manually: ws://localhost:8000/ws/test-123
```

---

### Issue: Updates Not Received

**Symptoms**: WebSocket connected but page doesn't update

**Debug Steps**:
1. Check if subscribed to correct channel
2. Verify backend is broadcasting
3. Check server logs for broadcast messages
4. Monitor Redis pub/sub: `redis-cli MONITOR`

**Solution**:
```typescript
// Enable debug logging
const { subscribe } = useWebSocket('user-123', { debug: true });

// Check console for subscription confirmation
// Should see: "Subscribed to channel: orders"
```

---

### Issue: Page Refreshes Too Often

**Symptoms**: Page reloads constantly

**Cause**: Multiple subscriptions to same channel

**Solution**:
```typescript
// Ensure cleanup in useEffect
useEffect(() => {
  subscribe('orders', handler);

  return () => {
    unsubscribe('orders'); // ← IMPORTANT: Cleanup!
  };
}, [subscribe, unsubscribe]); // ← Add dependencies
```

---

## 9. Performance Considerations

### Connection Limits

- **Browser**: 6-10 WebSocket connections per domain
- **Server**: 1000+ concurrent connections (depends on resources)

### Message Frequency

- Keep messages < 1KB for optimal performance
- Debounce rapid updates (e.g., typing in search)
- Batch multiple small updates when possible

### Memory Management

- Unsubscribe from channels when component unmounts
- Clear message handlers to prevent memory leaks
- Use `useCallback` for handlers to prevent recreations

---

## Resources

- **WebSocket Docs**: `/docs/WEBSOCKETS.md`
- **Celery Docs**: `/apps/backend/docs/CELERY.md`
- **Plan**: `/C:\Users\Phill\.claude\plans\jiggly-humming-knuth.md`

---

**Questions?** Check Slack #ccw-erp-dev or main documentation.
