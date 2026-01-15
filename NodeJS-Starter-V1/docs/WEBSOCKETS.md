# WebSocket Real-Time Updates

Complete guide for using WebSockets in CCW-Online ERP for real-time bidirectional communication.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Backend Architecture](#backend-architecture)
- [Frontend Usage](#frontend-usage)
- [Channels](#channels)
- [Broadcasting Updates](#broadcasting-updates)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What Are WebSockets?

WebSockets provide **bidirectional real-time communication** between the browser and server:
- **Push updates**: Server can send updates instantly (no polling)
- **Low latency**: < 100ms for most messages
- **Persistent connection**: Single connection for multiple messages
- **Channel-based**: Subscribe only to data you need

### Architecture

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Browser    │◀───▶│  FastAPI    │◀───▶│    Redis     │
│  (WebSocket) │     │  (Server)   │     │  (Pub/Sub)   │
└──────────────┘     └─────────────┘     └──────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │   Server 2  │ (Horizontal Scaling)
                     │  (FastAPI)  │
                     └─────────────┘
```

**Benefits:**
- ✅ Instant UI updates without page refresh
- ✅ Multiple users see changes simultaneously
- ✅ Reduced server load (no polling)
- ✅ Better user experience

---

## Quick Start

### Prerequisites

1. **Redis running** (for pub/sub):
   ```bash
   docker ps | grep redis
   ```

2. **Backend running**:
   ```bash
   cd apps/backend
   uvicorn src.api.main:app --reload
   ```

3. **Frontend running**:
   ```bash
   cd apps/web
   npm run dev
   ```

### Test Connection

**Browser Console:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/test-client-123');

ws.onopen = () => {
    console.log('Connected!');

    // Subscribe to orders channel
    ws.send(JSON.stringify({
        action: 'subscribe',
        channel: 'orders'
    }));
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received:', message);
};
```

**Test broadcast** (new browser tab):
```
http://localhost:8000/ws/test?channel=orders&message=Hello from test
```

You should see "Hello from test" in the first tab's console.

---

## Backend Architecture

### Connection Manager

**Location**: `apps/backend/src/websockets/manager.py`

**Features:**
- Connection pooling and lifecycle management
- Redis pub/sub for multi-instance broadcasting
- Channel-based message routing
- Automatic reconnection handling
- Health checks

**Key Methods:**
```python
from src.websockets.manager import manager

# Register connection
await manager.connect(websocket, client_id)

# Remove connection
manager.disconnect(websocket, client_id)

# Subscribe to channel
await manager.subscribe_to_channel(client_id, "orders")

# Broadcast to channel
await manager.broadcast_to_channel("orders", {"type": "order_created", "data": {...}})

# Broadcast to all
await manager.broadcast_to_all({"type": "notification", "message": "System update"})
```

### WebSocket Endpoint

**Location**: `apps/backend/src/api/routes/websocket.py`

**Endpoint**: `ws://localhost:8000/ws/{client_id}?token=<optional_jwt>`

**Message Protocol:**

Client → Server:
```json
{
    "action": "subscribe",
    "channel": "orders"
}
```

Server → Client:
```json
{
    "type": "order_update",
    "action": "created",
    "order_id": "123",
    "data": {...},
    "channel": "orders",
    "timestamp": "2026-01-14T12:00:00Z"
}
```

---

## Frontend Usage

### React Hook: `useWebSocket`

**Location**: `apps/web/hooks/use-websocket.ts`

**Features:**
- Automatic reconnection with exponential backoff
- Channel subscription management
- Connection state tracking
- TypeScript support

### Basic Example

```tsx
import { useWebSocket } from '@/hooks/use-websocket';

export function OrdersPage() {
    const { subscribe, unsubscribe, connectionState } = useWebSocket('user-123');

    useEffect(() => {
        // Subscribe to orders channel
        const handler = (message) => {
            console.log('Order update:', message);

            if (message.action === 'created') {
                // Refresh orders list or add to state
                toast({
                    title: "New Order",
                    description: `Order ${message.data.order_number} created`
                });
            }
        };

        subscribe('orders', handler);

        // Cleanup on unmount
        return () => unsubscribe('orders');
    }, [subscribe, unsubscribe]);

    return (
        <div>
            <div>Connection: {connectionState}</div>
            {/* Your component UI */}
        </div>
    );
}
```

### Advanced Example with Multiple Channels

```tsx
import { useWebSocket } from '@/hooks/use-websocket';

export function Dashboard() {
    const [orders, setOrders] = useState([]);
    const [inventory, setInventory] = useState({});
    const [notifications, setNotifications] = useState([]);

    const { subscribe, unsubscribe, connectionState } = useWebSocket('user-123', {
        autoConnect: true,
        maxReconnectAttempts: 10,
        debug: true
    });

    useEffect(() => {
        // Subscribe to multiple channels
        const ordersHandler = (message) => {
            if (message.action === 'created') {
                setOrders(prev => [message.data, ...prev]);
            } else if (message.action === 'updated') {
                setOrders(prev => prev.map(o =>
                    o.id === message.order_id ? message.data : o
                ));
            }
        };

        const inventoryHandler = (message) => {
            setInventory(prev => ({
                ...prev,
                [message.product_id]: message.data
            }));
        };

        const notificationsHandler = (message) => {
            setNotifications(prev => [message, ...prev]);
        };

        subscribe('orders', ordersHandler);
        subscribe('inventory', inventoryHandler);
        subscribe('notifications', notificationsHandler);

        return () => {
            unsubscribe('orders');
            unsubscribe('inventory');
            unsubscribe('notifications');
        };
    }, [subscribe, unsubscribe]);

    return (
        <div>
            <ConnectionIndicator state={connectionState} />
            {/* Your dashboard UI */}
        </div>
    );
}
```

### Connection State Indicator

```tsx
function ConnectionIndicator({ state }: { state: ConnectionState }) {
    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs",
            {
                'bg-green-100 text-green-700': state === 'connected',
                'bg-yellow-100 text-yellow-700': state === 'connecting',
                'bg-gray-100 text-gray-700': state === 'disconnected',
                'bg-red-100 text-red-700': state === 'error',
            }
        )}>
            <div className={cn(
                "w-2 h-2 rounded-full",
                {
                    'bg-green-500 animate-pulse': state === 'connected',
                    'bg-yellow-500': state === 'connecting',
                    'bg-gray-500': state === 'disconnected',
                    'bg-red-500': state === 'error',
                }
            )} />
            <span className="capitalize">{state}</span>
        </div>
    );
}
```

---

## Channels

### Available Channels

| Channel | Purpose | Message Types |
|---------|---------|---------------|
| `orders` | Order updates | order_update (created, updated, status_changed, deleted) |
| `inventory` | Stock level changes | inventory_update (adjustment, movement) |
| `backorders` | Backorder allocation | backorder_update (created, allocated, fulfilled) |
| `containers` | Container tracking | container_update (eta_updated, status_changed, arrived) |
| `notifications` | System notifications | notification (info, warning, error) |
| `agents` | AI agent execution | agent_update (started, completed, failed) |

### Message Format

**Order Update:**
```json
{
    "type": "order_update",
    "action": "status_changed",
    "order_id": "123",
    "data": {
        "id": "123",
        "order_number": "ORD-2026-001",
        "status": "shipped",
        "customer_name": "Acme Corp"
    },
    "channel": "orders",
    "timestamp": "2026-01-14T15:30:00Z"
}
```

**Inventory Update:**
```json
{
    "type": "inventory_update",
    "product_id": "PROD-001",
    "warehouse": "sydney",
    "data": {
        "product_id": "PROD-001",
        "product_name": "Widget X",
        "warehouse": "sydney",
        "available": 45,
        "reserved": 10
    },
    "channel": "inventory",
    "timestamp": "2026-01-14T15:30:00Z"
}
```

**Notification:**
```json
{
    "type": "notification",
    "title": "Low Stock Alert",
    "message": "Product XYZ-123 is below reorder point",
    "severity": "warning",
    "action_url": "/inventory/products/XYZ-123",
    "timestamp": "2026-01-14T15:30:00Z"
}
```

---

## Broadcasting Updates

### From API Routes

**Location**: `apps/backend/src/websockets/events.py`

**Order Created:**
```python
from fastapi import APIRouter
from src.websockets.events import broadcast_order_update

router = APIRouter()

@router.post("/api/orders")
async def create_order(order_data: OrderCreate):
    # Create order in database
    new_order = await create_order_in_db(order_data)

    # Broadcast to WebSocket clients
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
```

**Order Status Changed:**
```python
@router.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str):
    # Update in database
    updated_order = await update_order_status_in_db(order_id, status)

    # Broadcast update
    await broadcast_order_update(
        order_id=order_id,
        action="status_changed",
        data={
            "id": order_id,
            "order_number": updated_order.order_number,
            "status": status,
            "updated_at": datetime.utcnow().isoformat(),
        }
    )

    return updated_order
```

**Inventory Adjustment:**
```python
from src.websockets.events import broadcast_inventory_update

@router.post("/api/inventory/adjust")
async def adjust_inventory(adjustment: InventoryAdjustment):
    # Adjust in database
    updated_stock = await adjust_stock_in_db(adjustment)

    # Broadcast update
    await broadcast_inventory_update(
        product_id=adjustment.product_id,
        warehouse=adjustment.warehouse,
        data={
            "product_id": adjustment.product_id,
            "warehouse": adjustment.warehouse,
            "available": updated_stock.available,
            "reserved": updated_stock.reserved,
        }
    )

    return updated_stock
```

**System Notification:**
```python
from src.websockets.events import broadcast_notification

@router.post("/api/alerts/low-stock")
async def check_low_stock():
    low_stock_products = await get_low_stock_products()

    for product in low_stock_products:
        await broadcast_notification(
            title="Low Stock Alert",
            message=f"{product.name} ({product.sku}) is below reorder point",
            severity="warning",
            action_url=f"/inventory/products/{product.id}"
        )

    return {"alerts_sent": len(low_stock_products)}
```

### From Celery Tasks

```python
from celery import Task
from src.scheduler.celery_app import celery_app
from src.websockets.events import broadcast_agent_update

@celery_app.task(bind=True)
def run_inventory_agent(self):
    # Send started notification
    asyncio.run(broadcast_agent_update(
        agent_name="inventory_agent",
        status="started",
        data={"task_id": self.request.id}
    ))

    try:
        # Run agent logic
        results = perform_inventory_check()

        # Send completed notification
        asyncio.run(broadcast_agent_update(
            agent_name="inventory_agent",
            status="completed",
            data={
                "task_id": self.request.id,
                "items_checked": len(results),
                "alerts_generated": results["alerts"],
            }
        ))

        return results
    except Exception as exc:
        # Send failed notification
        asyncio.run(broadcast_agent_update(
            agent_name="inventory_agent",
            status="failed",
            data={
                "task_id": self.request.id,
                "error": str(exc)
            }
        ))
        raise
```

---

## Testing

### Manual Testing

**1. Open WebSocket connection:**
```javascript
// Browser console
const ws = new WebSocket('ws://localhost:8000/ws/test-123');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.send(JSON.stringify({ action: 'subscribe', channel: 'orders' }));
```

**2. Trigger update from another tab:**
```
http://localhost:8000/ws/test?channel=orders&message=Test order created
```

**3. Verify message received in first tab**

### Integration Testing

```python
# apps/backend/tests/test_websocket.py
import pytest
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket

@pytest.mark.asyncio
async def test_websocket_connection(client: TestClient):
    with client.websocket_connect("/ws/test-client") as websocket:
        # Receive welcome message
        data = websocket.receive_json()
        assert data["type"] == "connection"
        assert data["status"] == "connected"

@pytest.mark.asyncio
async def test_channel_subscription(client: TestClient):
    with client.websocket_connect("/ws/test-client") as websocket:
        # Subscribe to channel
        websocket.send_json({"action": "subscribe", "channel": "orders"})

        # Receive subscription confirmation
        data = websocket.receive_json()
        assert data["type"] == "subscription"
        assert data["status"] == "subscribed"
        assert data["channel"] == "orders"
```

---

## Troubleshooting

### Connection Fails

**Symptom**: `WebSocket connection failed` in browser console

**Checklist**:
1. ✅ Backend running? `curl http://localhost:8000/health`
2. ✅ Redis running? `docker ps | grep redis`
3. ✅ Correct URL? Should be `ws://localhost:8000/ws/{client_id}`
4. ✅ CORS configured? Check `settings.cors_origins`

**Solution**:
```python
# apps/backend/src/config/settings.py
cors_origins: list[str] = Field(
    default=[
        "http://localhost:3000",
        "http://localhost:3001",
    ]
)
```

---

### Messages Not Received

**Symptom**: WebSocket connected but no messages

**Debug**:
```javascript
// Enable debug logging
const { subscribe } = useWebSocket('user-123', { debug: true });
```

**Check**:
1. ✅ Subscribed to correct channel?
2. ✅ Backend actually broadcasting? Check server logs
3. ✅ Redis pub/sub working? `redis-cli MONITOR`

---

### Frequent Disconnections

**Symptom**: WebSocket reconnects every few seconds

**Possible Causes**:
- Reverse proxy timeout (Nginx, Cloudflare)
- Firewall blocking long connections
- Browser tab throttling

**Solution**:
```nginx
# Nginx configuration
location /ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;  # 24 hours
}
```

---

### High Memory Usage

**Symptom**: Redis memory grows unbounded

**Solution**: Set expiration on pub/sub messages

```python
# In ConnectionManager
await self.redis_client.setex(
    f"ws:message:{message_id}",
    300,  # 5 minutes TTL
    json.dumps(message)
)
```

---

## Performance Considerations

### Connection Limits

- **Browser**: 6-10 WebSocket connections per domain
- **Server**: Depends on ulimit (typical: 1024 concurrent connections)

### Scaling

**Horizontal scaling** with Redis pub/sub:
```
┌────────────┐     ┌─────────┐     ┌────────────┐
│ Server 1   │────▶│  Redis  │◀────│  Server 2  │
│ (clients)  │     │ Pub/Sub │     │  (clients) │
└────────────┘     └─────────┘     └────────────┘
```

All servers share the same Redis → messages broadcasted to all instances.

### Message Size

- Keep messages < 1KB for optimal performance
- For large payloads, send an ID and let client fetch details via REST API

---

## Next Steps

1. **Week 5**: Integrate WebSocket updates into dashboard UI
2. Add WebSocket messages to all CRUD operations
3. Implement notification toast system
4. Add connection status indicator to navbar

---

**Questions?** Check [main documentation](../README.md) or Slack #ccw-erp-dev
