# CCW Product Catalog Reference

**Source**: Internal seed data (`apps/backend/scripts/seed_ccw_cleaning.py`)
**Last updated**: 2026-03-24
**Total products**: 65 (seed_ccw_cleaning.py) + 83 (docs/catalog/ccw-product-catalog.csv)

## ProductCategory Enum Mapping

The locked `ProductCategory` enum uses generic hardware categories. CCW cleaning equipment maps as follows:

| CCW Category                                | Enum Value           | Rationale                              |
| ------------------------------------------- | -------------------- | -------------------------------------- |
| Truckmounts                                 | `HEAVY_MACHINERY`    | Large vehicle-mounted units            |
| Portable Extractors / Pressure Washers      | `POWER_TOOLS`        | Powered portable equipment             |
| Cleaning Wands, Hoses & Hand Tools          | `HAND_TOOLS`         | Manual cleaning attachments            |
| PPE & Safety (gloves, goggles, respirators) | `SAFETY_EQUIPMENT`   | Personal protective equipment          |
| Chemicals, Pre-sprays & Solutions           | `BUILDING_MATERIALS` | Closest available enum for consumables |
| Vacuums, Blowers, Floor Machines            | `ELECTRICAL`         | Electrically powered equipment         |
| Water Treatment, Tanks & Pumps              | `PLUMBING`           | Water system components                |
| Pads, Bonnets & Consumables                 | `ACCESSORIES`        | General accessories                    |

> **Note**: The enum was designed for a generic hardware supplier. `BUILDING_MATERIALS` for chemicals is a pragmatic mapping — the enum cannot be changed without modifying `demo_models.py` (locked by CONSTITUTION).

## Seed Script Inventory

### seed_ccw_cleaning.py (65 products)

Full demo data generator with realistic Australian cleaning industry customers.

**Product breakdown by category:**

- `HEAVY_MACHINERY` (Truckmounts): 8 products (Prochem, Sapphire, Hydramaster)
- `POWER_TOOLS` (Portable Extractors): 10 products (Mytee, Ninja, Prochem, Karcher, Nilfisk, Tennant)
- `HAND_TOOLS` (Wands, Hoses): 10 products (Prochem, Sapphire, Rotovac)
- `SAFETY_EQUIPMENT` (PPE): 8 products (gloves, goggles, respirators, boots)
- `BUILDING_MATERIALS` (Chemicals): 10 products (Prochem, Master Blend, Tile Gels)
- `ELECTRICAL` (Vacuums, Blowers, Floor Machines): 8 products (Nilfisk, Karcher, Dri-Eaz, i-mop)
- `PLUMBING` (Water Systems): 6 products (inline heaters, RO filters, tanks, pumps)
- `ACCESSORIES` (Pads, Consumables): 11 products (bonnets, pads, bags, shoe covers)

**Customer breakdown**: 35 Australian cleaning businesses across all states/territories.

**Seed commands:**

```bash
cd apps/backend
uv run python scripts/seed_ccw_cleaning.py          # Full seed
```

### seed_ccw_products.py (CSV-based, 83 products)

CSV-driven upsert seeder with warehouse bay assignment.

**Source CSV**: `docs/catalog/ccw-product-catalog.csv`
**Features**: Idempotent (upsert by SKU), `--dry-run` flag, deterministic bay assignment.

**Seed commands:**

```bash
cd apps/backend
uv run python scripts/seed_ccw_products.py --dry-run  # Preview
uv run python scripts/seed_ccw_products.py            # Apply
```

## Key SKU Prefixes

| Prefix      | Category                  |
| ----------- | ------------------------- |
| CCW-TM-xxx  | Truckmounts               |
| CCW-PE-xxx  | Portable Extractors       |
| CCW-HT-xxx  | Hand Tools / Wands        |
| CCW-SF-xxx  | Safety / PPE              |
| CCW-CH-xxx  | Chemicals                 |
| CCW-VB-xxx  | Vacuums / Blowers         |
| CCW-WT-xxx  | Water Treatment           |
| CCW-AC-xxx  | Accessories               |
| CCW-TRK-xxx | Truckmounts (CSV catalog) |
| CCW-EXT-xxx | Extractors (CSV catalog)  |
| CCW-VAC-xxx | Vacuums (CSV catalog)     |
| CCW-CHM-xxx | Chemicals (CSV catalog)   |
