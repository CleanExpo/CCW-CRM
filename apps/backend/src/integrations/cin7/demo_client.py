"""Demo mode Cin7 clients for testing without real API calls.

Returns realistic mock data matching Cin7 Core and Omni API response structures.
Uses Australian equipment supplier data consistent with CCW's business.
"""

from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class Cin7CoreDemoClient:
    """Demo client mimicking Cin7 Core (DEAR Inventory) API responses."""

    def __init__(self) -> None:
        logger.info("cin7_core_demo_client_initialized")

    async def get_me(self) -> dict[str, Any]:
        """Return mock account info (Core /me endpoint)."""
        logger.info("demo_cin7_core_get_me")
        return {
            "Company": "CCW Equipment Suppliers",
            "Currency": "AUD",
            "TimeZone": "Australia/Brisbane",
            "LockDate": "2024-01-01",
            "TaxRule": "GST on Income",
            "DefaultAccount": "200",
        }

    async def get_products(
        self,
        page: int = 1,
        limit: int = 100,
        modified_since: str | None = None,
    ) -> dict[str, Any]:
        """Return mock products matching Core API structure."""
        logger.info("demo_cin7_core_get_products", page=page, limit=limit)
        return {
            "Total": 5,
            "Page": page,
            "Products": [
                {
                    "ID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                    "SKU": "HM-EXC-001",
                    "Name": "CAT 320 Excavator",
                    "Category": "Heavy Machinery",
                    "Brand": "Caterpillar",
                    "Type": "Stock",
                    "CostingMethod": "FIFO",
                    "DropShipMode": "No Drop Ship",
                    "DefaultLocation": "Brisbane Warehouse",
                    "UOM": "Each",
                    "PriceTier1": 285000.00,
                    "PriceTier2": 275000.00,
                    "AverageCost": 210000.00,
                    "LastModifiedOn": "2025-12-15T10:30:00",
                    "Status": "Active",
                },
                {
                    "ID": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                    "SKU": "PT-DRL-002",
                    "Name": "Makita 18V Hammer Drill Kit",
                    "Category": "Power Tools",
                    "Brand": "Makita",
                    "Type": "Stock",
                    "CostingMethod": "FIFO",
                    "DropShipMode": "No Drop Ship",
                    "DefaultLocation": "Brisbane Warehouse",
                    "UOM": "Each",
                    "PriceTier1": 549.00,
                    "PriceTier2": 499.00,
                    "AverageCost": 320.00,
                    "LastModifiedOn": "2025-12-10T14:20:00",
                    "Status": "Active",
                },
                {
                    "ID": "c3d4e5f6-a7b8-9012-cdef-123456789012",
                    "SKU": "SE-HRN-003",
                    "Name": "Full Body Safety Harness AS/NZS 1891",
                    "Category": "Safety Equipment",
                    "Brand": "3M",
                    "Type": "Stock",
                    "CostingMethod": "FIFO",
                    "DropShipMode": "No Drop Ship",
                    "DefaultLocation": "Sydney Branch",
                    "UOM": "Each",
                    "PriceTier1": 189.00,
                    "PriceTier2": 169.00,
                    "AverageCost": 95.00,
                    "LastModifiedOn": "2025-11-28T09:15:00",
                    "Status": "Active",
                },
                {
                    "ID": "d4e5f6a7-b8c9-0123-defa-234567890123",
                    "SKU": "BM-CEM-004",
                    "Name": "Portland Cement 20kg Bag",
                    "Category": "Building Materials",
                    "Brand": "Boral",
                    "Type": "Stock",
                    "CostingMethod": "FIFO",
                    "DropShipMode": "No Drop Ship",
                    "DefaultLocation": "Brisbane Warehouse",
                    "UOM": "Bag",
                    "PriceTier1": 12.50,
                    "PriceTier2": 10.80,
                    "AverageCost": 7.20,
                    "LastModifiedOn": "2025-12-01T11:45:00",
                    "Status": "Active",
                },
                {
                    "ID": "e5f6a7b8-c9d0-1234-efab-345678901234",
                    "SKU": "EL-CBL-005",
                    "Name": "TPS 2.5mm Twin & Earth Cable 100m",
                    "Category": "Electrical",
                    "Brand": "Prysmian",
                    "Type": "Stock",
                    "CostingMethod": "FIFO",
                    "DropShipMode": "No Drop Ship",
                    "DefaultLocation": "Brisbane Warehouse",
                    "UOM": "Roll",
                    "PriceTier1": 185.00,
                    "PriceTier2": 165.00,
                    "AverageCost": 110.00,
                    "LastModifiedOn": "2025-12-05T16:00:00",
                    "Status": "Active",
                },
            ],
        }

    async def get_customers(
        self,
        page: int = 1,
        limit: int = 100,
        modified_since: str | None = None,
    ) -> dict[str, Any]:
        """Return mock customers matching Core API structure."""
        logger.info("demo_cin7_core_get_customers", page=page, limit=limit)
        return {
            "Total": 3,
            "Page": page,
            "CustomerList": [
                {
                    "ID": "cust-001-uuid",
                    "Name": "Queensland Civil Construction",
                    "Currency": "AUD",
                    "PaymentTerm": "30 days",
                    "Discount": 5.0,
                    "TaxRule": "GST on Income",
                    "Status": "Active",
                    "Contacts": [
                        {
                            "Name": "Dave Mitchell",
                            "Email": "dave@qldcivil.com.au",
                            "Phone": "0412 345 678",
                            "Default": True,
                        },
                    ],
                    "Addresses": [
                        {
                            "Line1": "42 Industrial Drive",
                            "City": "Brendale",
                            "State": "QLD",
                            "Postcode": "4500",
                            "Country": "Australia",
                            "Type": "Business",
                        },
                    ],
                },
                {
                    "ID": "cust-002-uuid",
                    "Name": "Sydney Metro Builders Pty Ltd",
                    "Currency": "AUD",
                    "PaymentTerm": "14 days",
                    "Discount": 0.0,
                    "TaxRule": "GST on Income",
                    "Status": "Active",
                    "Contacts": [
                        {
                            "Name": "Sarah Chen",
                            "Email": "sarah@sydneymetro.com.au",
                            "Phone": "0423 456 789",
                            "Default": True,
                        },
                    ],
                    "Addresses": [
                        {
                            "Line1": "88 Parramatta Road",
                            "City": "Granville",
                            "State": "NSW",
                            "Postcode": "2142",
                            "Country": "Australia",
                            "Type": "Business",
                        },
                    ],
                },
                {
                    "ID": "cust-003-uuid",
                    "Name": "Melbourne Plant Hire Co",
                    "Currency": "AUD",
                    "PaymentTerm": "30 days",
                    "Discount": 10.0,
                    "TaxRule": "GST on Income",
                    "Status": "Active",
                    "Contacts": [
                        {
                            "Name": "Tony Russo",
                            "Email": "tony@melbplanthire.com.au",
                            "Phone": "0434 567 890",
                            "Default": True,
                        },
                    ],
                    "Addresses": [
                        {
                            "Line1": "15 Dandenong Road",
                            "City": "Dandenong South",
                            "State": "VIC",
                            "Postcode": "3175",
                            "Country": "Australia",
                            "Type": "Business",
                        },
                    ],
                },
            ],
        }

    async def get_suppliers(
        self,
        page: int = 1,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Return mock suppliers matching Core API structure."""
        logger.info("demo_cin7_core_get_suppliers", page=page, limit=limit)
        return {
            "Total": 2,
            "Page": page,
            "SupplierList": [
                {
                    "ID": "sup-001-uuid",
                    "Name": "Caterpillar Australia",
                    "Currency": "AUD",
                    "PaymentTerm": "60 days",
                    "TaxRule": "GST on Purchases",
                    "Status": "Active",
                },
                {
                    "ID": "sup-002-uuid",
                    "Name": "Makita Australia Pty Ltd",
                    "Currency": "AUD",
                    "PaymentTerm": "30 days",
                    "TaxRule": "GST on Purchases",
                    "Status": "Active",
                },
            ],
        }

    async def get_sale_list(
        self,
        page: int = 1,
        limit: int = 100,
        modified_since: str | None = None,
    ) -> dict[str, Any]:
        """Return mock sale list matching Core API structure."""
        logger.info("demo_cin7_core_get_sale_list", page=page, limit=limit)
        return {
            "Total": 2,
            "Page": page,
            "SaleList": [
                {
                    "SaleID": "sale-001-uuid",
                    "SaleOrderNumber": "SO-2025-001",
                    "Customer": "Queensland Civil Construction",
                    "Status": "Authorised",
                    "Total": 285549.00,
                    "OrderDate": "2025-12-01",
                    "Lines": [
                        {
                            "LineID": "line-s1-001",
                            "SKU": "HM-EXC-001",
                            "Name": "CAT 320 Excavator",
                            "Quantity": 1,
                            "Price": 285000.00,
                            "Total": 285000.00,
                            "TaxRate": 0.10,
                        },
                        {
                            "LineID": "line-s1-002",
                            "SKU": "PT-DRL-002",
                            "Name": "Makita 18V Hammer Drill Kit",
                            "Quantity": 1,
                            "Price": 549.00,
                            "Total": 549.00,
                            "TaxRate": 0.10,
                        },
                    ],
                },
                {
                    "SaleID": "sale-002-uuid",
                    "SaleOrderNumber": "SO-2025-002",
                    "Customer": "Sydney Metro Builders Pty Ltd",
                    "Status": "Draft",
                    "Total": 1098.00,
                    "OrderDate": "2025-12-10",
                    "Lines": [
                        {
                            "LineID": "line-s2-001",
                            "SKU": "PT-DRL-002",
                            "Name": "Makita 18V Hammer Drill Kit",
                            "Quantity": 2,
                            "Price": 549.00,
                            "Total": 1098.00,
                            "TaxRate": 0.10,
                        },
                    ],
                },
            ],
        }

    async def get_purchase_list(
        self,
        page: int = 1,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Return mock purchase list matching Core API structure."""
        logger.info("demo_cin7_core_get_purchase_list", page=page, limit=limit)
        return {
            "Total": 1,
            "Page": page,
            "PurchaseList": [
                {
                    "PurchaseID": "po-001-uuid",
                    "PurchaseOrderNumber": "PO-2025-001",
                    "Supplier": "Caterpillar Australia",
                    "Status": "Ordered",
                    "Total": 420000.00,
                    "OrderDate": "2025-11-15",
                    "Lines": [
                        {
                            "LineID": "line-p1-001",
                            "SKU": "HM-EXC-001",
                            "Name": "CAT 320 Excavator",
                            "Quantity": 2,
                            "Price": 210000.00,
                            "Total": 420000.00,
                            "TaxRate": 0.10,
                        },
                    ],
                },
            ],
        }

    async def get_product_availability(
        self,
        sku: str | None = None,
    ) -> dict[str, Any]:
        """Return mock product availability matching Core API structure."""
        logger.info("demo_cin7_core_get_product_availability", sku=sku)
        return {
            "Total": 3,
            "ProductAvailabilityList": [
                {
                    "ID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                    "SKU": "HM-EXC-001",
                    "Name": "CAT 320 Excavator",
                    "Location": "Brisbane Warehouse",
                    "OnHand": 3.0,
                    "Allocated": 1.0,
                    "Available": 2.0,
                    "OnOrder": 2.0,
                },
                {
                    "ID": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                    "SKU": "PT-DRL-002",
                    "Name": "Makita 18V Hammer Drill Kit",
                    "Location": "Brisbane Warehouse",
                    "OnHand": 45.0,
                    "Allocated": 8.0,
                    "Available": 37.0,
                    "OnOrder": 20.0,
                },
                {
                    "ID": "c3d4e5f6-a7b8-9012-cdef-123456789012",
                    "SKU": "SE-HRN-003",
                    "Name": "Full Body Safety Harness AS/NZS 1891",
                    "Location": "Sydney Branch",
                    "OnHand": 120.0,
                    "Allocated": 15.0,
                    "Available": 105.0,
                    "OnOrder": 0.0,
                },
            ],
        }

    async def get_locations(self) -> dict[str, Any]:
        """Return mock locations matching Core API structure."""
        logger.info("demo_cin7_core_get_locations")
        return {
            "Total": 3,
            "LocationList": [
                {
                    "ID": "loc-001-uuid",
                    "Name": "Brisbane Warehouse",
                    "IsDefault": True,
                    "AddressLine1": "123 Industrial Avenue",
                    "City": "Eagle Farm",
                    "State": "QLD",
                    "PostCode": "4009",
                    "Country": "Australia",
                },
                {
                    "ID": "loc-002-uuid",
                    "Name": "Sydney Branch",
                    "IsDefault": False,
                    "AddressLine1": "456 Parramatta Road",
                    "City": "Homebush",
                    "State": "NSW",
                    "PostCode": "2140",
                    "Country": "Australia",
                },
                {
                    "ID": "loc-003-uuid",
                    "Name": "Melbourne Depot",
                    "IsDefault": False,
                    "AddressLine1": "789 Dandenong Road",
                    "City": "Dandenong South",
                    "State": "VIC",
                    "PostCode": "3175",
                    "Country": "Australia",
                },
            ],
        }

    async def get_product_categories(self) -> dict[str, Any]:
        """Return mock product categories."""
        logger.info("demo_cin7_core_get_product_categories")
        return {
            "Total": 6,
            "ProductCategoryList": [
                {"Name": "Heavy Machinery"},
                {"Name": "Power Tools"},
                {"Name": "Safety Equipment"},
                {"Name": "Building Materials"},
                {"Name": "Electrical"},
                {"Name": "Plumbing"},
            ],
        }

    async def get_product_brands(self) -> dict[str, Any]:
        """Return mock product brands."""
        logger.info("demo_cin7_core_get_product_brands")
        return {
            "Total": 5,
            "ProductBrandList": [
                {"Name": "Caterpillar"},
                {"Name": "Makita"},
                {"Name": "3M"},
                {"Name": "Boral"},
                {"Name": "Prysmian"},
            ],
        }


class Cin7OmniDemoClient:
    """Demo client mimicking Cin7 Omni API responses."""

    def __init__(self) -> None:
        logger.info("cin7_omni_demo_client_initialized")

    async def get_products(
        self,
        page: int = 1,
        rows: int = 50,
    ) -> list[dict[str, Any]]:
        """Return mock products matching Omni API structure (returns array)."""
        logger.info("demo_cin7_omni_get_products", page=page, rows=rows)
        return [
            {
                "id": 10001,
                "styleCode": "HM-EXC-001",
                "barcode": "9312345000001",
                "description": "CAT 320 Excavator",
                "category": "Heavy Machinery",
                "brand": "Caterpillar",
                "retailPrice": 285000.00,
                "wholesalePrice": 275000.00,
                "stockAvailable": 2,
                "stockOnHand": 3,
                "isActive": True,
                "modifiedDate": "2025-12-15T10:30:00Z",
            },
            {
                "id": 10002,
                "styleCode": "PT-DRL-002",
                "barcode": "9312345000002",
                "description": "Makita 18V Hammer Drill Kit",
                "category": "Power Tools",
                "brand": "Makita",
                "retailPrice": 549.00,
                "wholesalePrice": 499.00,
                "stockAvailable": 37,
                "stockOnHand": 45,
                "isActive": True,
                "modifiedDate": "2025-12-10T14:20:00Z",
            },
        ]

    async def get_contacts(
        self,
        page: int = 1,
        rows: int = 50,
    ) -> list[dict[str, Any]]:
        """Return mock contacts matching Omni API structure."""
        logger.info("demo_cin7_omni_get_contacts", page=page, rows=rows)
        return [
            {
                "id": 20001,
                "company": "Queensland Civil Construction",
                "firstName": "Dave",
                "lastName": "Mitchell",
                "email": "dave@qldcivil.com.au",
                "phone": "0412 345 678",
                "city": "Brendale",
                "state": "QLD",
                "postcode": "4500",
                "country": "Australia",
                "isActive": True,
                "type": "Customer",
            },
            {
                "id": 20002,
                "company": "Sydney Metro Builders Pty Ltd",
                "firstName": "Sarah",
                "lastName": "Chen",
                "email": "sarah@sydneymetro.com.au",
                "phone": "0423 456 789",
                "city": "Granville",
                "state": "NSW",
                "postcode": "2142",
                "country": "Australia",
                "isActive": True,
                "type": "Customer",
            },
        ]

    async def get_sales_orders(
        self,
        page: int = 1,
        rows: int = 50,
        modified_since: str | None = None,
    ) -> list[dict[str, Any]]:
        """Return mock sales orders matching Omni API structure."""
        logger.info("demo_cin7_omni_get_sales_orders", page=page, rows=rows)
        return [
            {
                "id": 30001,
                "reference": "SO-2025-001",
                "memberId": 20001,
                "stage": "Dispatched",
                "total": 285549.00,
                "createdDate": "2025-12-01T09:00:00Z",
                "lineItems": [
                    {
                        "id": 90001,
                        "styleCode": "HM-EXC-001",
                        "description": "CAT 320 Excavator",
                        "qty": 1,
                        "unitPrice": 285000.00,
                        "total": 285000.00,
                        "taxRate": 0.10,
                    },
                    {
                        "id": 90002,
                        "styleCode": "PT-DRL-002",
                        "description": "Makita 18V Hammer Drill Kit",
                        "qty": 1,
                        "unitPrice": 549.00,
                        "total": 549.00,
                        "taxRate": 0.10,
                    },
                ],
            },
        ]

    async def get_purchase_orders(
        self,
        page: int = 1,
        rows: int = 50,
    ) -> list[dict[str, Any]]:
        """Return mock purchase orders matching Omni API structure."""
        logger.info("demo_cin7_omni_get_purchase_orders", page=page, rows=rows)
        return [
            {
                "id": 40001,
                "reference": "PO-2025-001",
                "supplierName": "Caterpillar Australia",
                "status": "Ordered",
                "total": 420000.00,
                "createdDate": "2025-11-15T08:00:00Z",
                "lineItems": [
                    {
                        "id": 90010,
                        "styleCode": "HM-EXC-001",
                        "description": "CAT 320 Excavator",
                        "qty": 2,
                        "unitPrice": 210000.00,
                        "total": 420000.00,
                        "taxRate": 0.10,
                    },
                ],
            },
        ]

    async def get_quotes(
        self,
        page: int = 1,
        rows: int = 50,
    ) -> list[dict[str, Any]]:
        """Return mock quotes matching Omni API structure."""
        logger.info("demo_cin7_omni_get_quotes", page=page, rows=rows)
        return [
            {
                "id": 50001,
                "reference": "Q-2025-001",
                "memberId": 20002,
                "stage": "Pending",
                "total": 1647.00,
                "expiryDate": "2026-01-15T00:00:00Z",
                "createdDate": "2025-12-12T11:30:00Z",
            },
        ]

    async def get_stock(
        self,
        sku: str | None = None,
    ) -> list[dict[str, Any]]:
        """Return mock stock levels matching Omni API structure."""
        logger.info("demo_cin7_omni_get_stock", sku=sku)
        return [
            {
                "id": 10001,
                "styleCode": "HM-EXC-001",
                "stockAvailable": 2,
                "stockOnHand": 3,
                "stockOnOrder": 2,
                "branchId": 1,
                "branchName": "Brisbane Warehouse",
            },
            {
                "id": 10002,
                "styleCode": "PT-DRL-002",
                "stockAvailable": 37,
                "stockOnHand": 45,
                "stockOnOrder": 20,
                "branchId": 1,
                "branchName": "Brisbane Warehouse",
            },
        ]

    async def get_branches(self) -> list[dict[str, Any]]:
        """Return mock branches matching Omni API structure."""
        logger.info("demo_cin7_omni_get_branches")
        return [
            {
                "id": 1,
                "name": "Brisbane Warehouse",
                "isActive": True,
                "address": "123 Industrial Avenue, Eagle Farm QLD 4009",
            },
            {
                "id": 2,
                "name": "Sydney Branch",
                "isActive": True,
                "address": "456 Parramatta Road, Homebush NSW 2140",
            },
            {
                "id": 3,
                "name": "Melbourne Depot",
                "isActive": True,
                "address": "789 Dandenong Road, Dandenong South VIC 3175",
            },
        ]

    async def get_product_categories(self) -> list[dict[str, Any]]:
        """Return mock product categories matching Omni API structure."""
        logger.info("demo_cin7_omni_get_product_categories")
        return [
            {"id": 1, "name": "Heavy Machinery"},
            {"id": 2, "name": "Power Tools"},
            {"id": 3, "name": "Safety Equipment"},
            {"id": 4, "name": "Building Materials"},
            {"id": 5, "name": "Electrical"},
            {"id": 6, "name": "Plumbing"},
        ]
