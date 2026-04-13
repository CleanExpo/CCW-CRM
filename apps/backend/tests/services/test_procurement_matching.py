"""Tests for procurement matching service (GAP-026)."""
from decimal import Decimal
from uuid import uuid4

from src.services.procurement_matching import (
    GRNItem,
    InvoiceItemData,
    MatchStatus,
    POItem,
    Variance,
    VarianceType,
    get_variance_summary,
    is_variance_acceptable,
    match_po_grn_invoice,
)


class TestMatchPoGrnInvoice:
    """Test three-way matching logic."""

    def test_perfect_match(self):
        """Test when PO, GRN, and Invoice all match perfectly."""
        product_id = uuid4()

        po_items = [
            POItem(product_id=product_id, quantity=10, unit_cost=Decimal("100.00"))
        ]
        grn_items = [
            GRNItem(product_id=product_id, quantity_received=10)
        ]
        invoice_items = [
            InvoiceItemData(product_id=product_id, quantity=10, unit_price=Decimal("100.00"))
        ]

        result = match_po_grn_invoice(po_items, grn_items, invoice_items)

        assert result.match_status == MatchStatus.FULL_MATCH
        assert result.confidence == 1.0
        assert len(result.variances) == 0

    def test_quantity_variance(self):
        """Test quantity mismatch between PO and GRN."""
        product_id = uuid4()

        po_items = [
            POItem(product_id=product_id, quantity=10, unit_cost=Decimal("100.00"))
        ]
        grn_items = [
            GRNItem(product_id=product_id, quantity_received=8)  # Received less
        ]
        invoice_items = [
            InvoiceItemData(product_id=product_id, quantity=10, unit_price=Decimal("100.00"))
        ]

        result = match_po_grn_invoice(po_items, grn_items, invoice_items)

        assert result.match_status == MatchStatus.PARTIAL_MATCH
        assert result.variance_count == 1
        assert result.variances[0].variance_type == VarianceType.QUANTITY
        assert result.variances[0].expected == 10
        assert result.variances[0].actual == 8

    def test_price_variance(self):
        """Test price mismatch between PO and Invoice."""
        product_id = uuid4()

        po_items = [
            POItem(product_id=product_id, quantity=10, unit_cost=Decimal("100.00"))
        ]
        grn_items = [
            GRNItem(product_id=product_id, quantity_received=10)
        ]
        invoice_items = [
            InvoiceItemData(product_id=product_id, quantity=10, unit_price=Decimal("110.00"))
        ]

        result = match_po_grn_invoice(po_items, grn_items, invoice_items)

        assert result.match_status == MatchStatus.PARTIAL_MATCH
        assert result.variance_count == 1
        assert result.variances[0].variance_type == VarianceType.PRICE
        assert result.variances[0].expected == Decimal("100.00")
        assert result.variances[0].actual == Decimal("110.00")

    def test_missing_item_in_grn(self):
        """Test item in PO but not received (missing in GRN)."""
        product_id = uuid4()

        po_items = [
            POItem(product_id=product_id, quantity=10, unit_cost=Decimal("100.00"))
        ]
        grn_items = []  # Nothing received
        invoice_items = [
            InvoiceItemData(product_id=product_id, quantity=10, unit_price=Decimal("100.00"))
        ]

        result = match_po_grn_invoice(po_items, grn_items, invoice_items)

        assert result.match_status == MatchStatus.PARTIAL_MATCH
        assert result.variance_count == 1
        missing_variance = next(
            v for v in result.variances if v.variance_type == VarianceType.MISSING_ITEM
        )
        assert missing_variance.expected == 10
        assert missing_variance.actual == 0

    def test_extra_item_in_invoice(self):
        """Test item invoiced but not in PO (extra item)."""
        product_id_po = uuid4()
        product_id_extra = uuid4()

        po_items = [
            POItem(product_id=product_id_po, quantity=10, unit_cost=Decimal("100.00"))
        ]
        grn_items = [
            GRNItem(product_id=product_id_po, quantity_received=10)
        ]
        invoice_items = [
            InvoiceItemData(product_id=product_id_po, quantity=10, unit_price=Decimal("100.00")),
            InvoiceItemData(product_id=product_id_extra, quantity=5, unit_price=Decimal("50.00")),
        ]

        result = match_po_grn_invoice(po_items, grn_items, invoice_items)

        assert result.match_status == MatchStatus.PARTIAL_MATCH
        assert result.variance_count == 1
        extra_variance = next(
            v for v in result.variances if v.variance_type == VarianceType.EXTRA_ITEM
        )
        assert extra_variance.product_id == product_id_extra
        assert extra_variance.actual == 5

    def test_multiple_items_perfect_match(self):
        """Test matching with multiple products."""
        product_id_1 = uuid4()
        product_id_2 = uuid4()

        po_items = [
            POItem(product_id=product_id_1, quantity=10, unit_cost=Decimal("100.00")),
            POItem(product_id=product_id_2, quantity=20, unit_cost=Decimal("50.00")),
        ]
        grn_items = [
            GRNItem(product_id=product_id_1, quantity_received=10),
            GRNItem(product_id=product_id_2, quantity_received=20),
        ]
        invoice_items = [
            InvoiceItemData(product_id=product_id_1, quantity=10, unit_price=Decimal("100.00")),
            InvoiceItemData(product_id=product_id_2, quantity=20, unit_price=Decimal("50.00")),
        ]

        result = match_po_grn_invoice(po_items, grn_items, invoice_items)

        assert result.match_status == MatchStatus.FULL_MATCH
        assert result.confidence == 1.0
        assert len(result.variances) == 0

    def test_multiple_variances(self):
        """Test when multiple variances exist."""
        product_id_1 = uuid4()
        product_id_2 = uuid4()

        po_items = [
            POItem(product_id=product_id_1, quantity=10, unit_cost=Decimal("100.00")),
            POItem(product_id=product_id_2, quantity=20, unit_cost=Decimal("50.00")),
        ]
        grn_items = [
            GRNItem(product_id=product_id_1, quantity_received=8),  # Quantity variance
            GRNItem(product_id=product_id_2, quantity_received=20),
        ]
        invoice_items = [
            InvoiceItemData(product_id=product_id_1, quantity=10, unit_price=Decimal("110.00")),  # Price variance
            InvoiceItemData(product_id=product_id_2, quantity=20, unit_price=Decimal("50.00")),
        ]

        result = match_po_grn_invoice(po_items, grn_items, invoice_items)

        assert result.match_status == MatchStatus.PARTIAL_MATCH
        assert result.variance_count == 2
        assert result.confidence < 1.0

    def test_empty_lists(self):
        """Test with empty lists (edge case)."""
        result = match_po_grn_invoice([], [], [])

        assert result.match_status == MatchStatus.NO_MATCH
        assert result.confidence == 0.0
        assert len(result.variances) == 0

    def test_confidence_calculation(self):
        """Test confidence score calculation."""
        # 2 products, 1 variance = 75% confidence (1 - 1/4)
        product_id_1 = uuid4()
        product_id_2 = uuid4()

        po_items = [
            POItem(product_id=product_id_1, quantity=10, unit_cost=Decimal("100.00")),
            POItem(product_id=product_id_2, quantity=20, unit_cost=Decimal("50.00")),
        ]
        grn_items = [
            GRNItem(product_id=product_id_1, quantity_received=8),  # Variance
            GRNItem(product_id=product_id_2, quantity_received=20),  # OK
        ]
        invoice_items = [
            InvoiceItemData(product_id=product_id_1, quantity=10, unit_price=Decimal("100.00")),
            InvoiceItemData(product_id=product_id_2, quantity=20, unit_price=Decimal("50.00")),
        ]

        result = match_po_grn_invoice(po_items, grn_items, invoice_items)

        assert result.variance_count == 1
        assert 0.7 <= result.confidence <= 0.8  # ~75% confidence


class TestGetVarianceSummary:
    """Test variance summary function."""

    def test_summary_with_all_variance_types(self):
        """Test summary includes all variance types."""
        product_id = uuid4()

        variances = [
            Variance(
                variance_type=VarianceType.QUANTITY,
                product_id=product_id,
                expected=10,
                actual=8,
                description="Qty variance",
            ),
            Variance(
                variance_type=VarianceType.PRICE,
                product_id=product_id,
                expected=Decimal("100"),
                actual=Decimal("110"),
                description="Price variance",
            ),
            Variance(
                variance_type=VarianceType.MISSING_ITEM,
                product_id=product_id,
                expected=5,
                actual=0,
                description="Missing",
            ),
            Variance(
                variance_type=VarianceType.EXTRA_ITEM,
                product_id=product_id,
                expected=0,
                actual=3,
                description="Extra",
            ),
        ]

        from src.services.procurement_matching import MatchResult, MatchStatus

        result = MatchResult(
            match_status=MatchStatus.PARTIAL_MATCH,
            variances=variances,
            confidence=0.5,
        )

        summary = get_variance_summary(result)

        assert summary["total_variances"] == 4
        assert summary["quantity_variances"] == 1
        assert summary["price_variances"] == 1
        assert summary["missing_items"] == 1
        assert summary["extra_items"] == 1

    def test_summary_empty(self):
        """Test summary with no variances."""
        from src.services.procurement_matching import MatchResult, MatchStatus

        result = MatchResult(
            match_status=MatchStatus.FULL_MATCH,
            variances=[],
            confidence=1.0,
        )

        summary = get_variance_summary(result)

        assert summary["total_variances"] == 0
        assert summary["quantity_variances"] == 0
        assert summary["price_variances"] == 0


class TestIsVarianceAcceptable:
    """Test variance tolerance checking."""

    def test_quantity_variance_within_tolerance(self):
        """Test quantity variance within 5% tolerance."""
        variance = Variance(
            variance_type=VarianceType.QUANTITY,
            product_id=uuid4(),
            expected=100,
            actual=97,  # 3% variance
            description="Qty variance",
        )

        assert is_variance_acceptable(variance) is True

    def test_quantity_variance_exceeds_tolerance(self):
        """Test quantity variance exceeds 5% tolerance."""
        variance = Variance(
            variance_type=VarianceType.QUANTITY,
            product_id=uuid4(),
            expected=100,
            actual=90,  # 10% variance
            description="Qty variance",
        )

        assert is_variance_acceptable(variance) is False

    def test_price_variance_within_tolerance(self):
        """Test price variance within 2% tolerance."""
        variance = Variance(
            variance_type=VarianceType.PRICE,
            product_id=uuid4(),
            expected=Decimal("100.00"),
            actual=Decimal("101.50"),  # 1.5% variance
            description="Price variance",
        )

        assert is_variance_acceptable(variance) is True

    def test_price_variance_exceeds_tolerance(self):
        """Test price variance exceeds 2% tolerance."""
        variance = Variance(
            variance_type=VarianceType.PRICE,
            product_id=uuid4(),
            expected=Decimal("100.00"),
            actual=Decimal("105.00"),  # 5% variance
            description="Price variance",
        )

        assert is_variance_acceptable(variance) is False

    def test_missing_item_never_acceptable(self):
        """Test missing items are never acceptable."""
        variance = Variance(
            variance_type=VarianceType.MISSING_ITEM,
            product_id=uuid4(),
            expected=10,
            actual=0,
            description="Missing",
        )

        assert is_variance_acceptable(variance) is False

    def test_extra_item_never_acceptable(self):
        """Test extra items are never acceptable."""
        variance = Variance(
            variance_type=VarianceType.EXTRA_ITEM,
            product_id=uuid4(),
            expected=0,
            actual=5,
            description="Extra",
        )

        assert is_variance_acceptable(variance) is False
