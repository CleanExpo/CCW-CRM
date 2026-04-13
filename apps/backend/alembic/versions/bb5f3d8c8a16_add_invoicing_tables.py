"""add_invoicing_tables

Revision ID: bb5f3d8c8a16
Revises: f1g2h3i4j5k6
Create Date: 2026-02-06 10:17:01.831561

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'bb5f3d8c8a16'
down_revision: str | Sequence[str] | None = 'f1g2h3i4j5k6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create tax_rates table (no dependencies)
    op.execute("""
        CREATE TABLE IF NOT EXISTS tax_rates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(50) NOT NULL,
            rate DECIMAL(5,2) NOT NULL,
            country VARCHAR(2),
            is_default BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT now()
        )
    """)

    # Insert default GST rate
    op.execute("""
        INSERT INTO tax_rates (name, rate, country, is_default, is_active)
        VALUES ('GST (Australia)', 10.00, 'AU', true, true)
    """)

    # 2. Create invoices table
    op.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_number VARCHAR(50) UNIQUE NOT NULL,
            order_id UUID REFERENCES orders(id),
            customer_id UUID NOT NULL REFERENCES customers(id),

            -- Invoice details
            issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
            due_date DATE NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'draft',

            -- Financial
            subtotal DECIMAL(10,2) NOT NULL,
            tax_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
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
        )
    """)

    # Create indexes for invoices
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number)")

    # 3. Create invoice_items table
    op.execute("""
        CREATE TABLE IF NOT EXISTS invoice_items (
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
            subtotal DECIMAL(10,2) NOT NULL,
            total DECIMAL(10,2) NOT NULL,

            -- Metadata
            created_at TIMESTAMP NOT NULL DEFAULT now(),

            CONSTRAINT invoice_items_calculation_check CHECK (
                subtotal = quantity * unit_price AND
                total = subtotal + tax_amount
            )
        )
    """)

    # Create indexes for invoice_items
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id)")

    # 4. Create invoice_payments table (renamed to avoid conflict with existing payments table for Xero)
    op.execute("""
        CREATE TABLE IF NOT EXISTS invoice_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_id UUID NOT NULL REFERENCES invoices(id),

            -- Payment details
            payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
            amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
            payment_method VARCHAR(20) NOT NULL,

            -- Payment reference
            reference_number VARCHAR(100),
            notes TEXT,

            -- Metadata
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            created_by UUID REFERENCES users(id)
        )
    """)

    # Create indexes for invoice_payments
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON invoice_payments(payment_date)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_invoice_payments_method ON invoice_payments(payment_method)")


def downgrade() -> None:
    """Downgrade schema."""
    # Drop tables in reverse order due to foreign key constraints
    op.execute("DROP TABLE IF EXISTS invoice_payments CASCADE")
    op.execute("DROP TABLE IF EXISTS invoice_items CASCADE")
    op.execute("DROP TABLE IF EXISTS invoices CASCADE")
    op.execute("DROP TABLE IF EXISTS tax_rates CASCADE")
