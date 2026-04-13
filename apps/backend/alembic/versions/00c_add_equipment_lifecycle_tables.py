"""Add equipment_units and warranty_alerts tables for serial number + warranty tracking.

Revision ID: 00c_equipment_lifecycle
Revises: 00b_add_missing_inventory_tables
Create Date: 2026-03-25
"""
from collections.abc import Sequence

from alembic import op

revision: str = "00c_equipment_lifecycle"
down_revision: str | Sequence[str] | None = "00b_add_missing_inventory_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create equipment_units and warranty_alerts tables."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS equipment_units (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            serial_number VARCHAR(100) UNIQUE NOT NULL,
            product_id UUID REFERENCES products(id) ON DELETE SET NULL,
            customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
            order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
            purchase_date TIMESTAMPTZ,
            warranty_expiry TIMESTAMPTZ,
            warranty_months INTEGER,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_equipment_units_serial ON equipment_units(serial_number)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_equipment_units_customer ON equipment_units(customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_equipment_units_warranty_expiry ON equipment_units(warranty_expiry)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS warranty_alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            unit_id UUID NOT NULL REFERENCES equipment_units(id) ON DELETE CASCADE,
            alert_type VARCHAR(30) NOT NULL,
            alert_date TIMESTAMPTZ NOT NULL,
            resolved BOOLEAN NOT NULL DEFAULT FALSE,
            resolved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_warranty_alerts_unit ON warranty_alerts(unit_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS warranty_alerts")
    op.execute("DROP TABLE IF EXISTS equipment_units")
