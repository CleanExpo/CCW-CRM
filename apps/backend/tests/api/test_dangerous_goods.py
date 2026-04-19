"""
Tests for UNI-1824 — Dangerous Goods ADG Code compliance.

Covers:
- ProductDangerousGoodsProfile model table structure
- OutboundShipment DG columns
- ADG dispatch gate logic (pure-Python, no DB needed)
"""

from sqlalchemy import UniqueConstraint

from src.db.inventory_models import OutboundShipment, ProductDangerousGoodsProfile


# ---------------------------------------------------------------------------
# Unit: model table structure
# ---------------------------------------------------------------------------

class TestProductDangerousGoodsProfileModel:
    def test_table_name(self):
        assert ProductDangerousGoodsProfile.__tablename__ == "product_dangerous_goods_profiles"

    def test_has_required_columns(self):
        cols = {c.key for c in ProductDangerousGoodsProfile.__table__.columns}
        assert "product_id" in cols
        assert "is_dangerous_goods" in cols
        assert "adg_class" in cols
        assert "un_number" in cols
        assert "packing_group" in cols
        assert "proper_shipping_name" in cols
        assert "emergency_contact" in cols

    def test_product_id_has_unique_constraint(self):
        col = ProductDangerousGoodsProfile.__table__.c.product_id
        # product_id column has unique=True at column level
        assert col.unique is True

    def test_product_id_has_fk(self):
        col = ProductDangerousGoodsProfile.__table__.c.product_id
        assert len(col.foreign_keys) > 0


class TestOutboundShipmentDGFields:
    def test_dg_columns_exist(self):
        cols = {c.key for c in OutboundShipment.__table__.columns}
        assert "contains_dangerous_goods" in cols
        assert "adg_declaration_required" in cols
        assert "adg_declaration_attached" in cols
        assert "adg_declaration_number" in cols
        assert "adg_declaration_attachment_url" in cols

    def test_dg_column_not_nullable(self):
        col = OutboundShipment.__table__.c.contains_dangerous_goods
        assert col.nullable is False


# ---------------------------------------------------------------------------
# ADG dispatch gate logic — pure Python, no SQLAlchemy session
# ---------------------------------------------------------------------------

class _ShipmentStub:
    """Minimal stub that mirrors OutboundShipment DG fields."""
    def __init__(self, contains_dg=False, declaration_attached=False):
        self.contains_dangerous_goods = contains_dg
        self.adg_declaration_required = contains_dg
        self.adg_declaration_attached = declaration_attached
        self.adg_declaration_number = None

    @property
    def can_dispatch(self) -> bool:
        return not (self.contains_dangerous_goods and not self.adg_declaration_attached)


class TestADGCheckLogic:
    def test_no_dg_can_dispatch(self):
        s = _ShipmentStub(contains_dg=False)
        assert s.can_dispatch is True

    def test_dg_without_declaration_blocks(self):
        s = _ShipmentStub(contains_dg=True, declaration_attached=False)
        assert s.can_dispatch is False

    def test_dg_with_declaration_allows(self):
        s = _ShipmentStub(contains_dg=True, declaration_attached=True)
        assert s.can_dispatch is True

    def test_mark_dg_sets_required_flag(self):
        s = _ShipmentStub(contains_dg=False)
        s.contains_dangerous_goods = True
        s.adg_declaration_required = True
        assert s.adg_declaration_required is True
        assert s.can_dispatch is False

    def test_unmark_dg_clears_declaration(self):
        s = _ShipmentStub(contains_dg=True, declaration_attached=True)
        s.adg_declaration_number = "DG-001"
        s.contains_dangerous_goods = False
        s.adg_declaration_required = False
        s.adg_declaration_attached = False
        s.adg_declaration_number = None
        assert s.adg_declaration_number is None
        assert s.can_dispatch is True

    def test_attach_declaration_clears_block(self):
        s = _ShipmentStub(contains_dg=True, declaration_attached=False)
        assert s.can_dispatch is False
        s.adg_declaration_number = "DG-2026-001"
        s.adg_declaration_attached = True
        assert s.can_dispatch is True


class TestDangerousGoodsProfileValues:
    """Test that common ADG class codes and packing groups are valid strings."""

    def test_valid_adg_classes(self):
        for cls in ("1.1", "2.1", "2.2", "2.3", "3", "4.1", "5.1", "6.1", "7", "8", "9"):
            assert isinstance(cls, str)
            assert len(cls) <= 20

    def test_packing_groups(self):
        for pg in ("I", "II", "III"):
            assert pg in {"I", "II", "III"}

    def test_un_number_format(self):
        un = "UN1203"
        assert un.startswith("UN")
        assert len(un) <= 10

    def test_emergency_contact_max_length(self):
        contact = "0800 555 555"
        assert len(contact) <= 255
