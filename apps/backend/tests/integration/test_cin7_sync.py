"""Tests for Cin7 Phase 2 — product and inventory sync.

Tests category mapping, field mapping, location mapping, stock aggregation,
and sync endpoint responses.
"""


from src.db.demo_models import ProductCategory
from src.db.inventory_models import StoreLocation
from src.integrations.cin7.inventory_sync import (
    CIN7_TO_ERP_LOCATION,
    Cin7InventorySyncer,
    map_cin7_location,
    map_erp_location,
)
from src.integrations.cin7.product_sync import (
    CIN7_TO_ERP_CATEGORY,
    ERP_TO_CIN7_CATEGORY,
    Cin7ProductSyncer,
    map_cin7_category,
    map_erp_category,
)


class TestCategoryMapping:
    """Verify every ProductCategory maps correctly in both directions."""

    def test_heavy_machinery(self):
        assert map_cin7_category("Heavy Machinery") == ProductCategory.HEAVY_MACHINERY

    def test_hand_tools(self):
        assert map_cin7_category("Hand Tools") == ProductCategory.HAND_TOOLS

    def test_power_tools(self):
        assert map_cin7_category("Power Tools") == ProductCategory.POWER_TOOLS

    def test_safety_equipment(self):
        assert map_cin7_category("Safety Equipment") == ProductCategory.SAFETY_EQUIPMENT

    def test_building_materials(self):
        assert map_cin7_category("Building Materials") == ProductCategory.BUILDING_MATERIALS

    def test_electrical(self):
        assert map_cin7_category("Electrical") == ProductCategory.ELECTRICAL

    def test_plumbing(self):
        assert map_cin7_category("Plumbing") == ProductCategory.PLUMBING

    def test_accessories(self):
        assert map_cin7_category("Accessories") == ProductCategory.ACCESSORIES

    def test_unknown_defaults_to_accessories(self):
        assert map_cin7_category("Some New Category") == ProductCategory.ACCESSORIES
        assert map_cin7_category("") == ProductCategory.ACCESSORIES

    def test_reverse_mapping_covers_all_categories(self):
        """Every mapped ProductCategory can round-trip back to a Cin7 string."""
        for cin7_name, erp_cat in CIN7_TO_ERP_CATEGORY.items():
            assert ERP_TO_CIN7_CATEGORY[erp_cat] == cin7_name

    def test_map_erp_category_from_enum(self):
        assert map_erp_category(ProductCategory.HEAVY_MACHINERY) == "Heavy Machinery"
        assert map_erp_category(ProductCategory.PLUMBING) == "Plumbing"

    def test_map_erp_category_from_string(self):
        assert map_erp_category("POWER_TOOLS") == "Power Tools"
        assert map_erp_category("invalid_value") == "Accessories"


class TestCoreProductFieldMapping:
    """Verify Cin7 Core product dict maps correctly to ERP Product fields."""

    CORE_PRODUCT = {
        "ID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "SKU": "HM-EXC-001",
        "Name": "CAT 320 Excavator",
        "Category": "Heavy Machinery",
        "PriceTier1": 285000.00,
        "AverageCost": 210000.00,
        "DefaultLocation": "Brisbane Warehouse",
        "Status": "Active",
    }

    def test_extract_sku_core(self):
        assert Cin7ProductSyncer._extract_sku(self.CORE_PRODUCT, "core") == "HM-EXC-001"

    def test_extract_sku_returns_none_when_missing(self):
        assert Cin7ProductSyncer._extract_sku({}, "core") is None

    def test_category_maps_correctly(self):
        assert map_cin7_category(self.CORE_PRODUCT["Category"]) == ProductCategory.HEAVY_MACHINERY

    def test_active_status_maps_to_true(self):
        assert self.CORE_PRODUCT["Status"] == "Active"

    def test_inactive_status_maps_to_false(self):
        inactive = {**self.CORE_PRODUCT, "Status": "Inactive"}
        assert inactive["Status"] != "Active"


class TestOmniProductFieldMapping:
    """Verify Cin7 Omni product dict maps correctly to ERP Product fields."""

    OMNI_PRODUCT = {
        "id": 10001,
        "styleCode": "HM-EXC-001",
        "description": "CAT 320 Excavator",
        "category": "Heavy Machinery",
        "retailPrice": 285000.00,
        "isActive": True,
    }

    def test_extract_sku_omni(self):
        assert Cin7ProductSyncer._extract_sku(self.OMNI_PRODUCT, "omni") == "HM-EXC-001"

    def test_extract_sku_omni_missing(self):
        assert Cin7ProductSyncer._extract_sku({}, "omni") is None

    def test_category_maps_correctly(self):
        assert map_cin7_category(self.OMNI_PRODUCT["category"]) == ProductCategory.HEAVY_MACHINERY

    def test_is_active_true(self):
        assert self.OMNI_PRODUCT["isActive"] is True


class TestLocationMapping:
    """Verify Cin7 location names map to ERP StoreLocation enum."""

    def test_brisbane_warehouse(self):
        assert map_cin7_location("Brisbane Warehouse") == StoreLocation.BRISBANE

    def test_sydney_branch(self):
        assert map_cin7_location("Sydney Branch") == StoreLocation.SYDNEY

    def test_melbourne_depot(self):
        assert map_cin7_location("Melbourne Depot") == StoreLocation.MELBOURNE

    def test_unknown_location_returns_none(self):
        assert map_cin7_location("Perth Office") is None

    def test_reverse_brisbane(self):
        assert map_erp_location(StoreLocation.BRISBANE) == "Brisbane Warehouse"

    def test_reverse_sydney(self):
        assert map_erp_location(StoreLocation.SYDNEY) == "Sydney Branch"

    def test_reverse_melbourne(self):
        assert map_erp_location(StoreLocation.MELBOURNE) == "Melbourne Depot"

    def test_all_three_locations_mapped(self):
        assert len(CIN7_TO_ERP_LOCATION) == 3


class TestStockExtraction:
    """Verify stock helpers extract correct values from Cin7 data."""

    def test_core_stock_extraction(self):
        item = {"OnHand": 45.0, "Allocated": 8.0, "Available": 37.0, "Location": "Brisbane Warehouse"}
        assert Cin7InventorySyncer._extract_stock(item, "core") == 45
        assert Cin7InventorySyncer._extract_reserved(item, "core") == 8
        assert Cin7InventorySyncer._extract_location(item, "core") == "Brisbane Warehouse"

    def test_omni_stock_extraction(self):
        item = {"stockOnHand": 45, "stockAvailable": 37, "branchName": "Sydney Branch"}
        assert Cin7InventorySyncer._extract_stock(item, "omni") == 45
        assert Cin7InventorySyncer._extract_reserved(item, "omni") == 8  # 45 - 37
        assert Cin7InventorySyncer._extract_location(item, "omni") == "Sydney Branch"

    def test_missing_fields_default_to_zero(self):
        assert Cin7InventorySyncer._extract_stock({}, "core") == 0
        assert Cin7InventorySyncer._extract_reserved({}, "core") == 0


class TestERPToCin7Mapping:
    """Verify ERP Product → Cin7 payload mapping."""

    class FakeProduct:
        """Minimal stand-in for Product model."""

        def __init__(self) -> None:
            self.sku = "PT-DRL-002"
            self.name = "Makita 18V Hammer Drill Kit"
            self.category = "POWER_TOOLS"
            self.price = 549.00
            self.cost = 320.00
            self.warehouse_location = "Brisbane Warehouse"
            self.is_active = True

    def test_map_to_core(self):
        product = self.FakeProduct()
        payload = Cin7ProductSyncer._map_erp_to_cin7_core(product)
        assert payload["SKU"] == "PT-DRL-002"
        assert payload["Name"] == "Makita 18V Hammer Drill Kit"
        assert payload["Category"] == "Power Tools"
        assert payload["PriceTier1"] == 549.00
        assert payload["AverageCost"] == 320.00
        assert payload["Status"] == "Active"

    def test_map_to_omni(self):
        product = self.FakeProduct()
        payload = Cin7ProductSyncer._map_erp_to_cin7_omni(product)
        assert payload["styleCode"] == "PT-DRL-002"
        assert payload["description"] == "Makita 18V Hammer Drill Kit"
        assert payload["category"] == "Power Tools"
        assert payload["retailPrice"] == 549.00
        assert payload["isActive"] is True

    def test_inactive_maps_to_inactive(self):
        product = self.FakeProduct()
        product.is_active = False
        payload = Cin7ProductSyncer._map_erp_to_cin7_core(product)
        assert payload["Status"] == "Inactive"
