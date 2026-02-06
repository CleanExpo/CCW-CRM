# Implementation Plan: UNI-173 - Invoicing & Financial Module

**Status:** Planning
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 3 weeks
**Dependencies:** ✅ UNI-171 (CRM Module) - COMPLETED

---

## 🎯 Objective

Implement a complete invoicing and financial management system that enables:
- Invoice generation from orders
- Payment tracking (Cash, Card, Account)
- Tax calculation (GST/VAT)
- Financial reporting
- PDF invoice generation
- (Future) Xero/MYOB integration

---

## 📋 Requirements Analysis

### Core Features (Must Have)
1. **Invoice Management**
   - Create invoices manually or from existing orders
   - Edit draft invoices
   - Send invoices to customers
   - Track invoice status (Draft, Sent, Paid, Overdue, Cancelled)
   - Auto-generate unique invoice numbers (INV-YYYY-NNNN)

2. **Payment Processing**
   - Record payments against invoices
   - Support multiple payment methods (Cash, Card, Account/Credit)
   - Handle partial payments
   - Track payment history
   - Calculate outstanding balances

3. **Tax Calculation**
   - Configurable tax rates (GST 10%, VAT, etc.)
   - Line-item level tax application
   - Tax-inclusive vs tax-exclusive pricing
   - Tax reporting summaries

4. **PDF Generation**
   - Professional invoice templates
   - Company branding (logo, details)
   - Itemized breakdown
   - Payment terms and due dates
   - Download and email capability

5. **Financial Reporting**
   - Revenue by period (daily, weekly, monthly)
   - Outstanding invoices (accounts receivable)
   - Payment method breakdown
   - Tax collected summaries

### Nice to Have (Phase 2)
- Recurring invoices
- Payment reminders (automated emails)
- Credit notes and refunds
- Multi-currency support
- Xero/MYOB API integration

---

## 🗄️ Database Schema Design

### New Tables

#### 1. `invoices`
```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,  -- INV-2026-0001
    order_id UUID REFERENCES orders(id),          -- Optional: link to order
    customer_id UUID NOT NULL REFERENCES customers(id),

    -- Invoice details
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, sent, paid, overdue, cancelled

    -- Financial
    subtotal DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00, -- GST 10%
    tax_amount DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    amount_due DECIMAL(10,2) NOT NULL,

    -- Additional info
    notes TEXT,
    payment_terms TEXT DEFAULT 'Net 30',

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id),

    CONSTRAINT invoices_amounts_check CHECK (
        subtotal >= 0 AND
        tax_amount >= 0 AND
        total = subtotal + tax_amount AND
        amount_paid >= 0 AND
        amount_paid <= total AND
        amount_due = total - amount_paid
    )
);

CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
```

#### 2. `invoice_items`
```sql
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

    -- Item details
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),

    -- Tax
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    tax_amount DECIMAL(10,2) NOT NULL,

    -- Totals
    subtotal DECIMAL(10,2) NOT NULL,  -- quantity * unit_price
    total DECIMAL(10,2) NOT NULL,      -- subtotal + tax_amount

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT invoice_items_calculation_check CHECK (
        subtotal = quantity * unit_price AND
        total = subtotal + tax_amount
    )
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON invoice_items(product_id);
```

#### 3. `payments`
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),

    -- Payment details
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL,  -- cash, card, account, bank_transfer

    -- Payment reference
    reference_number VARCHAR(100),  -- Transaction ID, check number, etc.
    notes TEXT,

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_method ON payments(payment_method);
```

#### 4. `tax_rates` (Configuration)
```sql
CREATE TABLE tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,     -- "GST", "VAT", "Sales Tax"
    rate DECIMAL(5,2) NOT NULL,    -- 10.00 for 10%
    country VARCHAR(2),             -- AU, US, GB, etc.
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO tax_rates (name, rate, country, is_default, is_active)
VALUES ('GST (Australia)', 10.00, 'AU', true, true);
```

---

## 🔧 Backend Implementation

### File Structure
```
apps/backend/src/
├── db/
│   └── models/
│       └── invoicing.py          # New SQLAlchemy models
├── api/
│   └── routes/
│       ├── invoices.py           # Invoice CRUD endpoints
│       ├── payments.py           # Payment recording endpoints
│       └── financial_reports.py  # Reporting endpoints
├── services/
│   ├── invoice_service.py        # Business logic
│   ├── payment_service.py        # Payment processing
│   ├── tax_calculator.py         # Tax calculation utilities
│   └── pdf_generator.py          # Invoice PDF generation
└── alembic/versions/
    └── 006_add_invoicing_tables.py  # Migration
```

### API Endpoints

#### Invoices
- `GET    /api/invoices` - List invoices (with filters, pagination)
- `GET    /api/invoices/{id}` - Get invoice details
- `POST   /api/invoices` - Create new invoice
- `POST   /api/invoices/from-order/{order_id}` - Generate invoice from order
- `PUT    /api/invoices/{id}` - Update invoice
- `DELETE /api/invoices/{id}` - Delete invoice (draft only)
- `POST   /api/invoices/{id}/send` - Mark as sent
- `POST   /api/invoices/{id}/cancel` - Cancel invoice
- `GET    /api/invoices/{id}/pdf` - Download PDF

#### Payments
- `GET    /api/payments` - List all payments
- `GET    /api/invoices/{id}/payments` - Get payments for invoice
- `POST   /api/invoices/{id}/payments` - Record new payment
- `DELETE /api/payments/{id}` - Delete payment (admin only)

#### Reports
- `GET    /api/financial/revenue` - Revenue summary (by period)
- `GET    /api/financial/outstanding` - Outstanding invoices
- `GET    /api/financial/tax-summary` - Tax collected summary

### Pydantic Schemas
```python
# Request/Response models
class InvoiceItemCreate(BaseModel):
    product_id: UUID | None
    description: str
    quantity: int
    unit_price: Decimal
    tax_rate: Decimal = Decimal("10.00")

class InvoiceCreate(BaseModel):
    customer_id: UUID
    order_id: UUID | None
    due_date: date
    items: list[InvoiceItemCreate]
    notes: str | None
    payment_terms: str = "Net 30"

class PaymentCreate(BaseModel):
    amount: Decimal
    payment_method: str  # cash, card, account, bank_transfer
    payment_date: date
    reference_number: str | None
    notes: str | None

class InvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    customer: CustomerSummary
    issue_date: date
    due_date: date
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    items: list[InvoiceItemResponse]
    payments: list[PaymentResponse]
```

---

## 🎨 Frontend Implementation

### File Structure
```
apps/web/app/(dashboard)/
├── invoices/
│   ├── page.tsx                    # Invoice list
│   ├── [id]/
│   │   ├── page.tsx                # Invoice detail/edit
│   │   └── components/
│   │       ├── InvoiceForm.tsx     # Create/edit form
│   │       ├── InvoicePreview.tsx  # Preview before PDF
│   │       ├── PaymentForm.tsx     # Record payment
│   │       └── InvoiceActions.tsx  # Send, Cancel, Download
│   └── new/
│       └── page.tsx                # New invoice (manual or from order)
└── financial/
    └── page.tsx                    # Financial dashboard
```

### UI Components

#### 1. Invoice List Page (`/invoices`)
- **Features:**
  - Table with columns: Invoice #, Customer, Date, Due Date, Total, Amount Paid, Status
  - Status badges (Draft=gray, Sent=blue, Paid=green, Overdue=red)
  - Filters: Status, Customer, Date range
  - Search by invoice number
  - Actions: View, Edit (draft only), Record Payment, Download PDF
  - "Create Invoice" button

#### 2. Invoice Form (`/invoices/new`)
- **Features:**
  - Customer selector (dropdown with search)
  - Option to link to existing order (auto-fills items)
  - Date pickers (issue date, due date)
  - Dynamic line items:
    - Product search/selector
    - Description (editable)
    - Quantity, Unit Price (editable)
    - Tax rate per line
    - Calculated subtotal
  - Add/remove line items
  - Notes field
  - Payment terms dropdown
  - Real-time total calculation
  - Tax summary
  - Save as Draft / Save & Send buttons

#### 3. Invoice Detail Page (`/invoices/{id}`)
- **Features:**
  - Invoice header (number, dates, customer info)
  - Status badge
  - Itemized breakdown table
  - Subtotal, Tax, Total display
  - Payment history section
  - Amount Paid / Amount Due prominently displayed
  - Actions based on status:
    - Draft: Edit, Send, Delete
    - Sent: Record Payment, Cancel, Download PDF
    - Paid: View Only, Download PDF
    - Overdue: Record Payment, Send Reminder

#### 4. Payment Form (Modal)
- **Features:**
  - Amount input (with outstanding balance shown)
  - Payment method selector (Cash, Card, Account, Bank Transfer)
  - Payment date picker
  - Reference number (optional)
  - Notes (optional)
  - Validation: Amount cannot exceed amount due
  - Success: Updates invoice status if fully paid

#### 5. Financial Dashboard (`/financial`)
- **Features:**
  - Revenue chart (last 30 days)
  - Key metrics cards:
    - Total Revenue (this month)
    - Outstanding Invoices (count & amount)
    - Overdue Invoices (count & amount)
    - Tax Collected (this month)
  - Recent invoices table
  - Payment method breakdown pie chart

---

## 📄 PDF Generation

### Technology
- **Library:** `weasyprint` (Python) or `pdfkit`
- **Template:** HTML + CSS → PDF conversion
- **Storage:** Generate on-demand, optionally cache

### Invoice Template Design
```html
<!-- Invoice template structure -->
<div class="invoice">
  <header>
    <div class="company-info">
      <h1>CCW Equipment</h1>
      <p>Address, Phone, ABN</p>
    </div>
    <div class="invoice-info">
      <h2>INVOICE</h2>
      <p>Invoice #: INV-2026-0001</p>
      <p>Date: 06/02/2026</p>
      <p>Due: 06/03/2026</p>
    </div>
  </header>

  <section class="customer">
    <h3>Bill To:</h3>
    <p>Customer Name</p>
    <p>Address</p>
  </section>

  <table class="items">
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Tax</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      <!-- Line items -->
    </tbody>
  </table>

  <section class="totals">
    <div>Subtotal: $X,XXX.XX</div>
    <div>GST (10%): $XXX.XX</div>
    <div class="grand-total">Total: $X,XXX.XX</div>
  </section>

  <footer>
    <p>Payment Terms: Net 30</p>
    <p>Thank you for your business!</p>
  </footer>
</div>
```

---

## 🔢 Tax Calculation Logic

### Tax Service (`tax_calculator.py`)
```python
class TaxCalculator:
    @staticmethod
    def calculate_tax_inclusive(
        amount: Decimal,
        tax_rate: Decimal
    ) -> tuple[Decimal, Decimal]:
        """Calculate tax from tax-inclusive amount"""
        # If total is $110 with 10% tax:
        # Subtotal = 110 / 1.10 = 100
        # Tax = 110 - 100 = 10
        divisor = Decimal("1.0") + (tax_rate / Decimal("100"))
        subtotal = (amount / divisor).quantize(Decimal("0.01"))
        tax = amount - subtotal
        return subtotal, tax

    @staticmethod
    def calculate_tax_exclusive(
        amount: Decimal,
        tax_rate: Decimal
    ) -> tuple[Decimal, Decimal]:
        """Calculate tax from tax-exclusive amount"""
        # If subtotal is $100 with 10% tax:
        # Tax = 100 * 0.10 = 10
        # Total = 100 + 10 = 110
        tax = (amount * tax_rate / Decimal("100")).quantize(Decimal("0.01"))
        total = amount + tax
        return tax, total
```

---

## 🧪 Testing Strategy

### Backend Tests (`apps/backend/tests/api/test_invoices.py`)
- Create invoice from scratch
- Create invoice from existing order
- Calculate totals correctly (subtotal + tax = total)
- Validate invoice number uniqueness
- Record payment and update amounts
- Handle partial payments
- Mark invoice as paid when fully paid
- Prevent overpayment
- Generate PDF successfully

### Frontend Tests (`apps/web/__tests__/invoices/`)
- Invoice list displays correctly
- Create invoice form validation
- Add/remove line items
- Calculate totals in real-time
- Record payment updates invoice
- Download PDF button works

---

## 📦 Dependencies

### Backend
```toml
# pyproject.toml additions
dependencies = [
    "weasyprint>=60.0",  # PDF generation
    # or "pdfkit>=1.0.0"
]
```

### Frontend
- No new dependencies (use existing shadcn/ui components)
- Date pickers: react-day-picker (already installed)
- PDF viewer: Browser native or `react-pdf` if needed

---

## 🚀 Implementation Phases

### Phase 1: Database & Models (Day 1-2)
- [ ] Create Alembic migration
- [ ] Define SQLAlchemy models
- [ ] Define Pydantic schemas
- [ ] Run migration and verify

### Phase 2: Backend API (Day 3-5)
- [ ] Invoice CRUD endpoints
- [ ] Payment recording endpoints
- [ ] Tax calculation service
- [ ] Auto-generate invoice numbers
- [ ] Status workflow logic
- [ ] Write backend tests

### Phase 3: Frontend UI (Day 6-10)
- [ ] Invoice list page
- [ ] Invoice form component
- [ ] Invoice detail page
- [ ] Payment form modal
- [ ] Real-time calculations
- [ ] Status badges and actions
- [ ] Write frontend tests

### Phase 4: PDF Generation (Day 11-12)
- [ ] Create invoice template (HTML/CSS)
- [ ] Implement PDF service
- [ ] PDF download endpoint
- [ ] Test PDF rendering

### Phase 5: Financial Reporting (Day 13-14)
- [ ] Revenue summary endpoint
- [ ] Outstanding invoices report
- [ ] Tax summary
- [ ] Financial dashboard UI
- [ ] Charts and visualizations

### Phase 6: Testing & Polish (Day 15)
- [ ] End-to-end testing
- [ ] Fix bugs
- [ ] Performance optimization
- [ ] Documentation
- [ ] Demo preparation

---

## ✅ Success Criteria

1. **Functionality:**
   - ✅ Can create invoices manually or from orders
   - ✅ Can record payments with multiple methods
   - ✅ Tax is calculated correctly
   - ✅ Invoice status updates automatically
   - ✅ PDF generation works
   - ✅ Financial reports show accurate data

2. **Quality:**
   - ✅ All backend tests pass
   - ✅ All frontend tests pass
   - ✅ Type-check passes
   - ✅ Lint passes
   - ✅ No console errors

3. **User Experience:**
   - ✅ Invoice creation is intuitive
   - ✅ Payment recording is quick
   - ✅ PDFs look professional
   - ✅ Financial dashboard is informative

---

## 🔗 Related Issues

- **Depends on:** UNI-171 (CRM Module) ✅ COMPLETED
- **Blocks:** UNI-172 (Inventory) - Stock value reporting
- **Enables:** Complete order-to-cash workflow

---

## 📝 Notes

- Start with tax-exclusive pricing (simpler)
- Consider tax-inclusive option in Phase 2
- Xero/MYOB integration deferred to future phase
- Focus on Australian GST (10%) initially
- Multi-currency support is Phase 2

---

**Ready to start implementation?**
Let's begin with Phase 1: Database schema and models! 🚀
