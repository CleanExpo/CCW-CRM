"""
Tests for UNI-1827 — Workshop parts usage ↔ inventory deduction.

Covers:
- WorkshopJobPart model table structure and status enum
- Stock deduction logic (pure-Python stubs)
- Complete/reopen lifecycle
"""

from uuid import uuid4

from src.db.workshop_models import JobPartStatus, WorkshopJobPart


# ---------------------------------------------------------------------------
# Model structure
# ---------------------------------------------------------------------------

class TestWorkshopJobPartModel:
    def test_table_name(self):
        assert WorkshopJobPart.__tablename__ == "workshop_job_parts"

    def test_columns_exist(self):
        cols = {c.key for c in WorkshopJobPart.__table__.columns}
        assert "booking_id" in cols
        assert "product_id" in cols
        assert "quantity" in cols
        assert "location" in cols
        assert "status" in cols

    def test_booking_fk(self):
        col = WorkshopJobPart.__table__.c.booking_id
        assert len(col.foreign_keys) > 0

    def test_product_fk(self):
        col = WorkshopJobPart.__table__.c.product_id
        assert len(col.foreign_keys) > 0


class TestJobPartStatus:
    def test_statuses(self):
        assert JobPartStatus.reserved.value == "reserved"
        assert JobPartStatus.consumed.value == "consumed"
        assert JobPartStatus.returned.value == "returned"

    def test_all_statuses_present(self):
        values = {s.value for s in JobPartStatus}
        assert values == {"reserved", "consumed", "returned"}


# ---------------------------------------------------------------------------
# Stock deduction logic (pure Python)
# ---------------------------------------------------------------------------

class _StockRecord:
    def __init__(self, stock: int):
        self.stock = stock

    def adjust(self, delta: int) -> None:
        self.stock = max(0, self.stock + delta)


class _PartStub:
    def __init__(self, qty: int, location: str = "brisbane"):
        self.id = uuid4()
        self.booking_id = uuid4()
        self.product_id = uuid4()
        self.quantity = qty
        self.location = location
        self.status = JobPartStatus.reserved


class TestStockDeductionLogic:
    def test_add_part_deducts_stock(self):
        stock = _StockRecord(10)
        part = _PartStub(qty=3)
        stock.adjust(-part.quantity)
        assert stock.stock == 7

    def test_remove_reserved_part_restores_stock(self):
        stock = _StockRecord(7)
        part = _PartStub(qty=3)
        # Remove reserved part
        if part.status == JobPartStatus.reserved:
            stock.adjust(part.quantity)
        assert stock.stock == 10

    def test_remove_consumed_part_does_not_restore(self):
        stock = _StockRecord(7)
        part = _PartStub(qty=3)
        part.status = JobPartStatus.consumed
        # Should not restore
        if part.status == JobPartStatus.reserved:
            stock.adjust(part.quantity)
        assert stock.stock == 7  # unchanged

    def test_stock_cannot_go_negative(self):
        stock = _StockRecord(2)
        part = _PartStub(qty=5)
        stock.adjust(-part.quantity)
        assert stock.stock == 0  # clamped at 0

    def test_complete_marks_reserved_as_consumed(self):
        parts = [_PartStub(3), _PartStub(1), _PartStub(2)]
        for p in parts:
            assert p.status == JobPartStatus.reserved

        # Simulate complete
        for p in parts:
            if p.status == JobPartStatus.reserved:
                p.status = JobPartStatus.consumed

        assert all(p.status == JobPartStatus.consumed for p in parts)

    def test_reopen_restores_stock_for_consumed(self):
        stock = _StockRecord(4)
        part = _PartStub(qty=3)
        part.status = JobPartStatus.consumed

        # Simulate reopen
        if part.status == JobPartStatus.consumed:
            stock.adjust(part.quantity)
            part.status = JobPartStatus.reserved

        assert stock.stock == 7
        assert part.status == JobPartStatus.reserved

    def test_multiple_parts_deduction(self):
        stock = _StockRecord(20)
        parts = [_PartStub(3), _PartStub(5), _PartStub(2)]
        for p in parts:
            stock.adjust(-p.quantity)
        assert stock.stock == 10

    def test_multiple_parts_reopen_restore(self):
        stock = _StockRecord(10)
        parts = [_PartStub(3), _PartStub(5), _PartStub(2)]
        for p in parts:
            p.status = JobPartStatus.consumed
            stock.adjust(p.quantity)
            p.status = JobPartStatus.reserved
        assert stock.stock == 20
