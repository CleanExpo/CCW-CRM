"""Add technician_certifications and certification_alerts tables for IICRC tracking.

Revision ID: 00d_add_certification_tables
Revises: 00c_equipment_lifecycle
Create Date: 2026-03-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "00d_add_certification_tables"
down_revision: Union[str, Sequence[str], None] = "00c_equipment_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create technician_certifications and certification_alerts tables."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS technician_certifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            cert_body VARCHAR(20) NOT NULL,
            cert_type VARCHAR(100) NOT NULL,
            cert_number VARCHAR(100),
            technician_name VARCHAR(200),
            issue_date TIMESTAMPTZ,
            expiry_date TIMESTAMPTZ,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_tech_certs_customer ON technician_certifications(customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tech_certs_cert_body ON technician_certifications(cert_body)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tech_certs_expiry ON technician_certifications(expiry_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tech_certs_status ON technician_certifications(status)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS certification_alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cert_id UUID NOT NULL REFERENCES technician_certifications(id) ON DELETE CASCADE,
            days_until_expiry INTEGER NOT NULL,
            notified BOOLEAN NOT NULL DEFAULT FALSE,
            notified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_cert_alerts_cert ON certification_alerts(cert_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS certification_alerts")
    op.execute("DROP TABLE IF EXISTS technician_certifications")
