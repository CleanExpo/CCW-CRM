# Plan: UNI-171 — Core CRM Module

## Objective
Implement Contact management, Company profiles, Relationship mapping, and Activity timeline for the CCW-ERP/CRM system.

## Current State Analysis

### What Exists:
- **Customer model** - Basic company/contact info (single contact per customer)
- **OrderActivity** - Activity tracking for orders only
- **Full CRUD** for customers, orders, quotes
- **UI patterns** - Forms, tables, dialogs all established

### What's Missing:
- ❌ Multiple contacts per company
- ❌ Separate Contact entity
- ❌ General activity/interaction tracking
- ❌ Relationship mapping UI
- ❌ Activity timeline component

## Implementation Approach

**Strategy**: Create new CRM models in a separate file (`crm_models.py`) to avoid modifying existing `demo_models.py`. Link to existing Customer model via foreign keys.

---

## Database Schema (New Models)

### 1. Contact Model
```python
class Contact(Base):
    __tablename__ = "contacts"

    id: UUID (PK)
    customer_id: UUID (FK to customers) - nullable for standalone contacts
    first_name: str (required)
    last_name: str (required)
    email: str (optional, unique if provided)
    phone: str (optional)
    mobile: str (optional)
    job_title: str (optional)
    department: str (optional)
    is_primary: bool (default False) - primary contact for company
    is_active: bool (default True)
    notes: str (optional)
    created_at, updated_at: datetime
```

### 2. Activity Model
```python
class Activity(Base):
    __tablename__ = "activities"

    id: UUID (PK)
    activity_type: Enum (call, email, meeting, note, task)
    subject: str (required)
    description: text (optional)
    customer_id: UUID (FK, optional)
    contact_id: UUID (FK, optional)
    order_id: UUID (FK, optional)
    quote_id: UUID (FK, optional)
    due_date: datetime (optional)
    completed_at: datetime (optional)
    created_by: str
    created_at, updated_at: datetime
```

---

## Files to Create/Modify

### Backend (apps/backend/src/)

| File | Action | Description |
|------|--------|-------------|
| `db/crm_models.py` | **CREATE** | Contact & Activity SQLAlchemy models |
| `db/crm_schemas.py` | **CREATE** | Pydantic schemas for CRM |
| `api/routes/contacts.py` | **CREATE** | Contact CRUD endpoints |
| `api/routes/activities.py` | **CREATE** | Activity CRUD endpoints |
| `api/main.py` | **MODIFY** | Register new routers |
| `alembic/versions/xxx_add_crm_tables.py` | **CREATE** | Migration for new tables |

### Frontend (apps/web/)

| File | Action | Description |
|------|--------|-------------|
| `app/(dashboard)/contacts/page.tsx` | **CREATE** | Contacts list page |
| `app/(dashboard)/contacts/components/ContactForm.tsx` | **CREATE** | Contact create/edit form |
| `app/(dashboard)/contacts/components/ContactCard.tsx` | **CREATE** | Contact display card |
| `app/(dashboard)/customers/[id]/page.tsx` | **CREATE** | Customer detail with contacts |
| `components/ActivityTimeline.tsx` | **CREATE** | Reusable activity timeline |
| `components/ActivityForm.tsx` | **CREATE** | Log activity form |
| `lib/api/contacts.ts` | **CREATE** | Contact API client methods |
| `lib/api/activities.ts` | **CREATE** | Activity API client methods |
| `components/layout/sidebar.tsx` | **MODIFY** | Add Contacts menu item |

---

## Implementation Steps

### Phase 1: Database & Backend (Est: 2-3 hours)
1. Create `crm_models.py` with Contact and Activity models
2. Create `crm_schemas.py` with Pydantic schemas
3. Create Alembic migration
4. Apply migration to database
5. Create `contacts.py` API routes (CRUD)
6. Create `activities.py` API routes (CRUD)
7. Register routes in `main.py`
8. Test endpoints via Swagger/curl

### Phase 2: Contacts Frontend (Est: 2-3 hours)
1. Create `/contacts` page with list view
2. Create `ContactForm.tsx` for create/edit
3. Add search, pagination, filtering
4. Add bulk operations (delete, export)
5. Add to sidebar navigation

### Phase 3: Customer Detail Page (Est: 1-2 hours)
1. Create `/customers/[id]` detail page
2. Show customer info + related contacts
3. Add "Add Contact" button
4. Show contact cards with actions

### Phase 4: Activity Timeline (Est: 2-3 hours)
1. Create `ActivityTimeline.tsx` component
2. Create `ActivityForm.tsx` for logging activities
3. Integrate timeline into customer detail page
4. Add quick-log buttons (Call, Email, Note)
5. Filter activities by type/date

### Phase 5: Testing & Polish (Est: 1-2 hours)
1. Run type-check and lint
2. Write basic tests
3. Test all CRUD operations
4. Verify responsive design
5. Update Linear task status

---

## API Endpoints

### Contacts
```
GET    /api/contacts                    - List all contacts
GET    /api/contacts/{id}               - Get contact by ID
GET    /api/customers/{id}/contacts     - Get contacts for customer
POST   /api/contacts                    - Create contact
PUT    /api/contacts/{id}               - Update contact
DELETE /api/contacts/{id}               - Delete contact
```

### Activities
```
GET    /api/activities                  - List activities (with filters)
GET    /api/activities/{id}             - Get activity by ID
GET    /api/customers/{id}/activities   - Get activities for customer
GET    /api/contacts/{id}/activities    - Get activities for contact
POST   /api/activities                  - Log new activity
PUT    /api/activities/{id}             - Update activity
DELETE /api/activities/{id}             - Delete activity
```

---

## Success Criteria

- [ ] Contact CRUD fully functional
- [ ] Multiple contacts per customer supported
- [ ] Activity timeline displays chronologically
- [ ] Can log calls, emails, meetings, notes
- [ ] Customer detail page shows contacts + activities
- [ ] Contacts page in sidebar navigation
- [ ] Search and filter contacts
- [ ] Type-check passes
- [ ] Lint passes
- [ ] Basic tests pass
- [ ] Manual testing verified

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Schema changes affect existing data | New tables only, no modifications to existing |
| Migration fails | Test on clean DB first, backup before production |
| Performance with many activities | Add pagination, limit initial load |
| Breaking existing Customer features | Contacts are additive, Customer unchanged |

---

## Breaking Changes
**None** - All changes are additive. Existing Customer, Order, Quote functionality remains unchanged.

---

## Approval Required

**Question**: This plan creates new database tables (contacts, activities). Should I proceed with:

1. **Option A**: Create new tables via Alembic migration (recommended - clean approach)
2. **Option B**: Use existing Customer model only, add activities without new Contact table

Please confirm before I begin implementation.
