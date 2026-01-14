# Container Tracking & Backorder Setup Guide

## 🚀 Quick Start

### 1. Run Database Migration

```bash
cd apps/backend
uv run alembic upgrade head
```

**Expected output:**
```
INFO  [alembic.runtime.migration] Running upgrade f25b3ce9e866 -> d4f7a9b2e5c1, Add container tracking and backorders
```

### 2. Create Sample Data

```bash
cd apps/backend
uv run python scripts/create_container_sample_data.py
```

**This will create:**
- ✅ 3 Containers with different statuses:
  - 1 arriving in 7 days (in transit)
  - 1 at port in Sydney (customs clearance)
  - 1 overdue by 5 days (delayed)
- ✅ 8 Container items (products in containers)
- ✅ 3 Backorders linked to containers with ETAs
- ✅ 5 Heavy machinery products (if not already exist)

### 3. Start Servers

```bash
# Terminal 1 - Backend
cd apps/backend
uv run uvicorn src.api.main:app --reload

# Terminal 2 - Frontend
cd apps/web
pnpm dev
```

### 4. View in Browser

- **Containers**: http://localhost:3000/containers
- **Backorders**: http://localhost:3000/backorders
- **Orders**: http://localhost:3000/orders (enhanced with backorder status)
- **Alerts**: http://localhost:3000/alerts
- **Approvals**: http://localhost:3000/approvals

---

## 📦 What's Included

### Database Tables

1. **`containers`** - Shipping container tracking
   - Status progression: booked → in_transit → at_port → customs_clearance → cleared → out_for_delivery → delivered
   - Tracks vessel, ports, ETAs, carrier info, costs
   - JSONB tracking events for full history

2. **`container_items`** - Products in each container
   - Quantity tracking: ordered, received, damaged, preallocated
   - Unit costs and quality control
   - Links products to containers

3. **`backorders`** - Unfulfilled orders
   - Automatic ETA calculation from container arrivals
   - Customer notification tracking
   - Priority-based allocation
   - Status: pending → allocated → ready → fulfilled

### API Endpoints

#### Containers
- `GET /api/containers` - List with filters
- `GET /api/containers/arriving-soon` - Dashboard widget
- `GET /api/containers/{id}` - Full details
- `POST /api/containers` - Create new
- `PUT /api/containers/{id}` - Update
- `POST /api/containers/{id}/receive` - Mark as received
- `DELETE /api/containers/{id}` - Delete

#### Backorders
- `GET /api/backorders` - List with filters
- `GET /api/backorders/pending` - Dashboard widget
- `GET /api/backorders/{id}` - Full details
- `POST /api/backorders` - Create new
- `PUT /api/backorders/{id}` - Update
- `POST /api/backorders/{id}/allocate` - Allocate to container
- `POST /api/backorders/{id}/fulfill` - Fulfill order
- `POST /api/backorders/{id}/notify` - Send customer notification
- `DELETE /api/backorders/{id}` - Cancel

### Frontend Pages

1. **Containers Page** (`/containers`)
   - Three tabs: Arriving Soon, In Transit, All Containers
   - ETA countdown and overdue alerts
   - Container contents and backorder links
   - Tracking information display
   - Auto-refresh every 60 seconds

2. **Backorders Page** (`/backorders`)
   - Three tabs: Pending, Allocated, All Backorders
   - Priority indicators
   - Customer notification tracking
   - ETA display from linked containers
   - One-click customer notifications
   - Days outstanding tracking

3. **Alerts Page** (`/alerts`)
   - System notifications
   - Unread/All tabs
   - Mark as read/dismiss actions

4. **Approvals Page** (`/approvals`)
   - One-button approval workflow
   - Real-time updates
   - Approve/Reject with confirmation

---

## 🔄 Typical Workflow

### Creating a New Container

1. Navigate to `/containers`
2. Click "New Container"
3. Enter container details:
   - Container number (unique)
   - Vessel name and voyage number
   - Origin and destination ports
   - Estimated arrival date
   - Link to purchase order
4. Add products with quantities
5. Save - container is now tracked

### Managing Backorders

1. Navigate to `/backorders`
2. View pending backorders
3. Allocate to incoming container:
   - Click "Allocate to Container"
   - Select container
   - ETA automatically updates
4. Notify customer:
   - Click "Notify Customer"
   - Email sent with ETA
5. When container arrives:
   - Go to container detail page
   - Click "Mark as Received"
   - Backorders automatically fulfilled

### Receiving a Container

1. Navigate to `/containers/{id}`
2. Click "Mark as Received"
3. Confirm quantities received
4. Mark any damaged items
5. System automatically:
   - Updates stock levels
   - Fulfills allocated backorders
   - Sends customer notifications
   - Creates alerts

---

## 🎯 Key Features

### Automatic ETA Propagation
When a container's ETA changes, all linked backorder ETAs update automatically.

### Pre-allocation System
Reserve incoming stock for specific backorders before it arrives.

### Priority Scoring
High-priority backorders get preferential treatment during allocation.

### Overdue Detection
Automatic flagging of containers and backorders past their ETA.

### Event-Driven Architecture
All operations publish events for agent consumption:
- `container.created`
- `container.updated`
- `container.received`
- `backorder.created`
- `backorder.allocated`
- `backorder.fulfilled`
- `backorder.customer_notified`

### Real-time Monitoring
- Auto-refresh every 60 seconds on both pages
- Visual alerts for overdue items
- Status progression indicators

---

## 🧪 Testing Scenarios

### Test 1: Create and Track Container
1. Create new container with ETA in 10 days
2. Add products
3. Verify appears in "Arriving Soon" tab
4. Update ETA to 5 days
5. Verify countdown updates

### Test 2: Allocate Backorder
1. Create backorder for out-of-stock product
2. Create container with that product
3. Allocate backorder to container
4. Verify ETA displayed on backorder
5. Verify container shows pre-allocated quantity

### Test 3: Receive Container and Fulfill
1. Mark container as "received"
2. Enter quantities received
3. Verify stock levels updated
4. Verify allocated backorders fulfilled
5. Verify alerts created

### Test 4: Overdue Handling
1. Create container with ETA in past
2. Verify "Overdue" badge appears
3. Verify appears in overdue filter
4. Update ETA to future date
5. Verify badge removed

---

## 🔧 Troubleshooting

### Migration Issues

**Error: "relation already exists"**
```bash
# Check current version
cd apps/backend
uv run alembic current

# If needed, mark migration as applied without running
uv run alembic stamp d4f7a9b2e5c1
```

**Error: "enum type already exists"**
- Drop and recreate enums manually in psql
- Or modify migration to use `checkfirst=True`

### Sample Data Issues

**Error: "foreign key constraint failed"**
- Ensure you have at least one supplier and products
- Run: `uv run python scripts/create_erp_test_data.py` first

**Error: "no orders found"**
- Sample data will work without orders
- Backorders will be created without customer links
- Create orders manually or import from demo data

### Frontend Issues

**Containers page empty**
- Check backend is running
- Check browser console for API errors
- Verify API endpoint: http://localhost:8000/api/containers

**Navigation menu items missing**
- Clear browser cache
- Restart frontend dev server
- Check sidebar.tsx has Ship and AlertCircle icons

---

## 📚 Additional Resources

### Database Schema
See: `apps/backend/src/db/container_models.py`

### API Routes
- Containers: `apps/backend/src/api/routes/containers.py`
- Backorders: `apps/backend/src/api/routes/backorders.py`

### Frontend Components
- Containers: `apps/web/app/(dashboard)/containers/page.tsx`
- Backorders: `apps/web/app/(dashboard)/backorders/page.tsx`

### Migration File
See: `apps/backend/alembic/versions/d4f7a9b2e5c1_add_container_tracking_and_backorders.py`

---

## 🎉 Success Criteria

You'll know everything is working when:

- ✅ Migration runs without errors
- ✅ Sample data script completes successfully
- ✅ Containers page shows 3 containers
- ✅ Backorders page shows linked backorders
- ✅ "Arriving Soon" shows container with 7-day ETA
- ✅ Overdue alert shows for 5-day-late container
- ✅ Navigation menu shows new pages
- ✅ Auto-refresh works (watch status updates)

---

**Need Help?** Check the logs:
- Backend: Terminal running uvicorn
- Frontend: Terminal running pnpm dev
- Browser: Developer Console (F12)
