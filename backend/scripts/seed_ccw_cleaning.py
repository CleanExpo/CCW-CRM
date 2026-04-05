"""
CCW Cleaning Equipment Demo Data Seeder.

Generates realistic cleaning-industry sample data for demos:
- 65 cleaning equipment products (truckmounts, extractors, vacuums, chemicals, accessories)
- 35 cleaning-industry customers (carpet cleaners, commercial cleaners, restorers)
- 30 orders with line items (6 months history)
- 18 quotes (mix of statuses)
- Demo admin user

Usage:
    cd apps/backend
    uv run python scripts/seed_ccw_cleaning.py

Run against local Docker DB or set DATABASE_URL env var for Supabase.
"""
# ruff: noqa: E501

import asyncio
import os
import random
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Allow running from repo root or apps/backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.db.demo_models import (
    Customer,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductCategory,
    Quote,
    QuoteItem,
    QuoteStatus,
)
from src.db.models_base import Base, User

# ---------------------------------------------------------------------------
# Database URL — prefer env var, fall back to local Docker default
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://starter_user:local_dev_password@localhost:5433/starter_db",
)

# ---------------------------------------------------------------------------
# CCW Cleaning Equipment Product Catalogue
# ---------------------------------------------------------------------------
CLEANING_PRODUCTS: dict[ProductCategory, list[dict]] = {
    # Truckmount carpet-cleaning machines (mapped to heavy_machinery)
    ProductCategory.HEAVY_MACHINERY: [
        {"name": "Prochem Blazer GT Truckmount", "sku": "CCW-TM-001", "price": 28500, "cost": 22000, "stock": 3, "loc": "Brisbane Main"},
        {"name": "Sapphire Scientific 370SS Truckmount", "sku": "CCW-TM-002", "price": 32000, "cost": 25000, "stock": 2, "loc": "Brisbane Main"},
        {"name": "Hydramaster Boxxer 318 Truckmount", "sku": "CCW-TM-003", "price": 38500, "cost": 30000, "stock": 2, "loc": "Sydney Metro"},
        {"name": "Prochem Everest 650 Truckmount", "sku": "CCW-TM-004", "price": 45000, "cost": 35500, "stock": 1, "loc": "Brisbane Main"},
        {"name": "Hydramaster Titan 325 Truckmount", "sku": "CCW-TM-005", "price": 42000, "cost": 33000, "stock": 2, "loc": "Melbourne Central"},
        {"name": "Sapphire S570 Powerheat Truckmount", "sku": "CCW-TM-006", "price": 36000, "cost": 28500, "stock": 1, "loc": "Sydney Metro"},
        {"name": "Prochem Galaxy GT Truckmount", "sku": "CCW-TM-007", "price": 31000, "cost": 24500, "stock": 3, "loc": "Brisbane Main"},
        {"name": "Hydramaster Boxxer 427 HD Truckmount", "sku": "CCW-TM-008", "price": 52000, "cost": 41000, "stock": 1, "loc": "Brisbane Main"},
    ],
    # Portable extractors & steam cleaners (mapped to power_tools)
    ProductCategory.POWER_TOOLS: [
        {"name": "Mytee Escape 8070 Portable Extractor", "sku": "CCW-PE-001", "price": 3200, "cost": 2500, "stock": 8, "loc": "Brisbane Main"},
        {"name": "Ninja Flex 500 Portable Extractor", "sku": "CCW-PE-002", "price": 2850, "cost": 2200, "stock": 12, "loc": "Sydney Metro"},
        {"name": "Prochem Steempro Powerplus Steam Cleaner", "sku": "CCW-PE-003", "price": 4500, "cost": 3500, "stock": 6, "loc": "Melbourne Central"},
        {"name": "Karcher Puzzi 30/4 Carpet Extractor", "sku": "CCW-PE-004", "price": 1950, "cost": 1500, "stock": 15, "loc": "Brisbane Main"},
        {"name": "Mytee 8803DX Dry Extraction Machine", "sku": "CCW-PE-005", "price": 3800, "cost": 2950, "stock": 5, "loc": "Brisbane Main"},
        {"name": "Alto K-1600 Cold Pressure Washer", "sku": "CCW-PE-006", "price": 2200, "cost": 1700, "stock": 10, "loc": "Sydney Metro"},
        {"name": "Karcher HDS 12/18-4S Hot Pressure Washer", "sku": "CCW-PE-007", "price": 6500, "cost": 5100, "stock": 4, "loc": "Brisbane Main"},
        {"name": "Prochem Steempro Delphi Steam Injection", "sku": "CCW-PE-008", "price": 5800, "cost": 4600, "stock": 3, "loc": "Melbourne Central"},
        {"name": "Nilfisk SC250 Walk-Behind Scrubber", "sku": "CCW-PE-009", "price": 7200, "cost": 5700, "stock": 4, "loc": "Brisbane Main"},
        {"name": "Tennant T1 Compact Scrubber-Dryer", "sku": "CCW-PE-010", "price": 8900, "cost": 7100, "stock": 2, "loc": "Sydney Metro"},
    ],
    # Cleaning wands, hoses & hand tools (mapped to hand_tools)
    ProductCategory.HAND_TOOLS: [
        {"name": "Prochem 12in Dual Jet Stair Tool", "sku": "CCW-HT-001", "price": 185, "cost": 120, "stock": 35, "loc": "Brisbane Main"},
        {"name": "Sapphire 14in Double Bend Wand", "sku": "CCW-HT-002", "price": 210, "cost": 145, "stock": 28, "loc": "Brisbane Main"},
        {"name": "Prochem Swivel Cuff 1.5in", "sku": "CCW-HT-003", "price": 45, "cost": 28, "stock": 80, "loc": "Sydney Metro"},
        {"name": "Solution Hose 1.5in x 15m", "sku": "CCW-HT-004", "price": 135, "cost": 85, "stock": 45, "loc": "Brisbane Main"},
        {"name": "Vacuum Hose 2in x 15m Crushproof", "sku": "CCW-HT-005", "price": 165, "cost": 105, "stock": 40, "loc": "Brisbane Main"},
        {"name": "Tile & Grout Cleaning Tool Turbojet", "sku": "CCW-HT-006", "price": 485, "cost": 320, "stock": 18, "loc": "Melbourne Central"},
        {"name": "Prochem 3.5in Hard Floor Cleaning Tool", "sku": "CCW-HT-007", "price": 320, "cost": 210, "stock": 22, "loc": "Brisbane Main"},
        {"name": "Rotovac 360i Rotary Carpet Tool", "sku": "CCW-HT-008", "price": 1250, "cost": 950, "stock": 8, "loc": "Brisbane Main"},
        {"name": "Upholstery Cleaning Tool 6in", "sku": "CCW-HT-009", "price": 95, "cost": 60, "stock": 55, "loc": "Sydney Metro"},
        {"name": "Squeeze Mop Handle Aluminium 1.4m", "sku": "CCW-HT-010", "price": 38, "cost": 22, "stock": 90, "loc": "Brisbane Main"},
    ],
    # PPE for cleaning industry (mapped to safety_equipment)
    ProductCategory.SAFETY_EQUIPMENT: [
        {"name": "Chemical Resistant Gloves Nitrile L", "sku": "CCW-SF-001", "price": 18.99, "cost": 9.50, "stock": 250, "loc": "Brisbane Main"},
        {"name": "Chemical Resistant Gloves Nitrile XL", "sku": "CCW-SF-002", "price": 18.99, "cost": 9.50, "stock": 200, "loc": "Brisbane Main"},
        {"name": "Safety Goggles Chemical Splash", "sku": "CCW-SF-003", "price": 14.99, "cost": 7.00, "stock": 180, "loc": "Sydney Metro"},
        {"name": "P2 Dust & Mist Respirator (box 20)", "sku": "CCW-SF-004", "price": 39.99, "cost": 22.00, "stock": 120, "loc": "Brisbane Main"},
        {"name": "Waterproof Rubber Apron", "sku": "CCW-SF-005", "price": 32.99, "cost": 18.00, "stock": 75, "loc": "Melbourne Central"},
        {"name": "Non-Slip Safety Boots Gumboots", "sku": "CCW-SF-006", "price": 89.99, "cost": 52.00, "stock": 60, "loc": "Brisbane Main"},
        {"name": "Hi-Vis Safety Vest Day/Night Use", "sku": "CCW-SF-007", "price": 24.99, "cost": 12.00, "stock": 150, "loc": "Brisbane Main"},
        {"name": "First Aid Kit Commercial 125pc", "sku": "CCW-SF-008", "price": 79.99, "cost": 45.00, "stock": 40, "loc": "Brisbane Main"},
    ],
    # Cleaning chemicals & pre-sprays (mapped to building_materials)
    ProductCategory.BUILDING_MATERIALS: [
        {"name": "Prochem Prespray Premium 5L", "sku": "CCW-CH-001", "price": 68.00, "cost": 38.00, "stock": 85, "loc": "Brisbane Main"},
        {"name": "Prochem Spot & Stain Remover 5L", "sku": "CCW-CH-002", "price": 72.00, "cost": 42.00, "stock": 70, "loc": "Brisbane Main"},
        {"name": "Master Blend 4-CTA Complete 5kg", "sku": "CCW-CH-003", "price": 185.00, "cost": 120.00, "stock": 45, "loc": "Brisbane Main"},
        {"name": "Prochem Traffic Lane Cleaner 5L", "sku": "CCW-CH-004", "price": 62.00, "cost": 35.00, "stock": 90, "loc": "Sydney Metro"},
        {"name": "Tile & Grout Cleaner Acid Gel 5L", "sku": "CCW-CH-005", "price": 58.00, "cost": 32.00, "stock": 65, "loc": "Brisbane Main"},
        {"name": "Encapsulation Detergent 5L", "sku": "CCW-CH-006", "price": 75.00, "cost": 44.00, "stock": 55, "loc": "Melbourne Central"},
        {"name": "Urine Pre-Spray Enzyme 5L", "sku": "CCW-CH-007", "price": 82.00, "cost": 48.00, "stock": 50, "loc": "Brisbane Main"},
        {"name": "Hard Floor Cleaner Neutral pH 5L", "sku": "CCW-CH-008", "price": 45.00, "cost": 25.00, "stock": 100, "loc": "Brisbane Main"},
        {"name": "Fabric Protector Scotchgard Pro 4L", "sku": "CCW-CH-009", "price": 145.00, "cost": 95.00, "stock": 35, "loc": "Sydney Metro"},
        {"name": "Anti-Foam Defoamer 5L", "sku": "CCW-CH-010", "price": 38.00, "cost": 20.00, "stock": 110, "loc": "Brisbane Main"},
    ],
    # Vacuums, blowers & floor machines (mapped to electrical)
    ProductCategory.ELECTRICAL: [
        {"name": "Nilfisk GM80P 3-Motor Backpack Vacuum", "sku": "CCW-VB-001", "price": 1850, "cost": 1400, "stock": 12, "loc": "Brisbane Main"},
        {"name": "Karcher BV 5/1 Battery Backpack Vac", "sku": "CCW-VB-002", "price": 2200, "cost": 1700, "stock": 8, "loc": "Brisbane Main"},
        {"name": "Prochem Dri-EZ Portable Heater Blower", "sku": "CCW-VB-003", "price": 1650, "cost": 1250, "stock": 10, "loc": "Sydney Metro"},
        {"name": "Dri-Eaz F351 LGR 2800i Dehumidifier", "sku": "CCW-VB-004", "price": 3800, "cost": 2950, "stock": 5, "loc": "Brisbane Main"},
        {"name": "Dri-Eaz Velo Pro Air Mover Flood Fan", "sku": "CCW-VB-005", "price": 695, "cost": 480, "stock": 25, "loc": "Brisbane Main"},
        {"name": "i-mop XL Floor Scrubber", "sku": "CCW-VB-006", "price": 4200, "cost": 3300, "stock": 6, "loc": "Melbourne Central"},
        {"name": "Powr-Flite PAS15-3 Burnisher 1500RPM", "sku": "CCW-VB-007", "price": 2800, "cost": 2150, "stock": 7, "loc": "Brisbane Main"},
        {"name": "Clarke Encore L17 Rotary Floor Machine", "sku": "CCW-VB-008", "price": 1950, "cost": 1500, "stock": 9, "loc": "Sydney Metro"},
    ],
    # Water treatment, inline heaters, pumps (mapped to plumbing)
    ProductCategory.PLUMBING: [
        {"name": "Prochem Inline Heater 240V", "sku": "CCW-WT-001", "price": 1250, "cost": 950, "stock": 6, "loc": "Brisbane Main"},
        {"name": "RO Water Filter System 4-Stage", "sku": "CCW-WT-002", "price": 850, "cost": 620, "stock": 8, "loc": "Brisbane Main"},
        {"name": "Pump Sprayer 5L Stainless Steel", "sku": "CCW-WT-003", "price": 125, "cost": 78, "stock": 40, "loc": "Brisbane Main"},
        {"name": "Fresh Water Holding Tank 100L", "sku": "CCW-WT-004", "price": 385, "cost": 260, "stock": 15, "loc": "Brisbane Main"},
        {"name": "Waste Water Tank 100L Polyethylene", "sku": "CCW-WT-005", "price": 340, "cost": 225, "stock": 15, "loc": "Sydney Metro"},
        {"name": "12V Water Pump Transfer Self-Priming", "sku": "CCW-WT-006", "price": 185, "cost": 110, "stock": 30, "loc": "Brisbane Main"},
    ],
    # Pads, bonnets, brush rolls & consumables (mapped to accessories)
    ProductCategory.ACCESSORIES: [
        {"name": "Cotton Carpet Bonnets 45cm (10pk)", "sku": "CCW-AC-001", "price": 65.00, "cost": 38.00, "stock": 75, "loc": "Brisbane Main"},
        {"name": "Microfibre Encapsulation Pads 17in (5pk)", "sku": "CCW-AC-002", "price": 89.00, "cost": 52.00, "stock": 60, "loc": "Brisbane Main"},
        {"name": "Scrubbing Brush Roll 45cm Soft", "sku": "CCW-AC-003", "price": 78.00, "cost": 48.00, "stock": 45, "loc": "Brisbane Main"},
        {"name": "Black Stripping Pad 17in (5pk)", "sku": "CCW-AC-004", "price": 42.00, "cost": 24.00, "stock": 100, "loc": "Sydney Metro"},
        {"name": "White Polishing Pad 17in (5pk)", "sku": "CCW-AC-005", "price": 42.00, "cost": 24.00, "stock": 95, "loc": "Brisbane Main"},
        {"name": "Carpet Cleaning Badge & ID Holder", "sku": "CCW-AC-006", "price": 8.99, "cost": 4.50, "stock": 200, "loc": "Brisbane Main"},
        {"name": "Corner Guard Sticky Foam Strip (10pk)", "sku": "CCW-AC-007", "price": 22.00, "cost": 12.00, "stock": 150, "loc": "Brisbane Main"},
        {"name": "Shoe Covers Polypropylene Blue (100pk)", "sku": "CCW-AC-008", "price": 18.99, "cost": 9.00, "stock": 300, "loc": "Brisbane Main"},
        {"name": "Cleaning Report Pad (50 pages)", "sku": "CCW-AC-009", "price": 15.99, "cost": 7.50, "stock": 120, "loc": "Sydney Metro"},
        {"name": "Vacuum Bags Nilfisk GM/GD Series (10pk)", "sku": "CCW-AC-010", "price": 28.99, "cost": 14.00, "stock": 180, "loc": "Brisbane Main"},
        {"name": "Fibre Pads for Rotovac (3pk)", "sku": "CCW-AC-011", "price": 55.00, "cost": 32.00, "stock": 55, "loc": "Brisbane Main"},
    ],
}

# ---------------------------------------------------------------------------
# Customer data — cleaning industry
# ---------------------------------------------------------------------------
CLEANING_CUSTOMERS = [
    # Queensland
    {"company": "Spotless Carpet Care Brisbane", "contact": "Mark Henderson", "email": "mark@spotlesscarpet.com.au", "phone": "0412 000 001", "address": "8 Cleanway Dr", "city": "Brisbane", "state": "QLD", "postcode": "4000"},
    {"company": "Sunshine Coast Steam Masters", "contact": "Karen Nguyen", "email": "karen@scsteammasters.com.au", "phone": "0413 000 002", "address": "22 Beach Access Rd", "city": "Maroochydore", "state": "QLD", "postcode": "4558"},
    {"company": "Gold Coast Carpet Clinic", "contact": "Troy Williams", "email": "troy@gccarapatclinic.com.au", "phone": "0414 000 003", "address": "14 Surfer St", "city": "Southport", "state": "QLD", "postcode": "4215"},
    {"company": "Townsville Commercial Cleaning Co", "contact": "Sandra Payne", "email": "sandra@tcclean.com.au", "phone": "0415 000 004", "address": "55 Industrial Ave", "city": "Townsville", "state": "QLD", "postcode": "4810"},
    {"company": "Pure Restore QLD", "contact": "Jason Liu", "email": "jason@purerestoreqld.com.au", "phone": "0416 000 005", "address": "18 Restoration Rd", "city": "Ipswich", "state": "QLD", "postcode": "4305"},
    {"company": "Queensland Hotel Group (Facilities)", "contact": "Fiona Clarke", "email": "fiona.clarke@qhgfacilities.com.au", "phone": "0417 000 006", "address": "300 Queen St", "city": "Brisbane", "state": "QLD", "postcode": "4000"},
    {"company": "Redlands Carpet & Tile Clean", "contact": "Peter Walsh", "email": "peter@redlandsclean.com.au", "phone": "0418 000 007", "address": "9 Bay Terrace", "city": "Cleveland", "state": "QLD", "postcode": "4163"},
    # New South Wales
    {"company": "Sydney Pro Steam Carpet Care", "contact": "Angela Martinez", "email": "angela@sydneyprosteam.com.au", "phone": "0419 000 008", "address": "42 Wentworth Ave", "city": "Sydney", "state": "NSW", "postcode": "2000"},
    {"company": "Newcastle Flood Restoration Services", "contact": "Bruce Thompson", "email": "bruce@ncastleflood.com.au", "phone": "0420 000 009", "address": "11 Hunter St", "city": "Newcastle", "state": "NSW", "postcode": "2300"},
    {"company": "Northern Beaches Carpet Masters", "contact": "Lisa Chen", "email": "lisa@nbcarpetmasters.com.au", "phone": "0421 000 010", "address": "5 Pacific Parade", "city": "Dee Why", "state": "NSW", "postcode": "2099"},
    {"company": "Canberra Office Cleaning Solutions", "contact": "Robert King", "email": "rob@canberraofficeclean.com.au", "phone": "0422 000 011", "address": "67 London Circuit", "city": "Canberra", "state": "ACT", "postcode": "2601"},
    {"company": "Wollongong Clean & Restore", "contact": "Tracey Burns", "email": "tracey@wollycleanrestore.com.au", "phone": "0423 000 012", "address": "33 Crown St", "city": "Wollongong", "state": "NSW", "postcode": "2500"},
    {"company": "Parramatta Strata Cleaning Group", "contact": "David Okonjo", "email": "david@parrastrata.com.au", "phone": "0424 000 013", "address": "88 Church St", "city": "Parramatta", "state": "NSW", "postcode": "2150"},
    # Victoria
    {"company": "Melbourne Carpet Revival", "contact": "Chris Anderson", "email": "chris@melbcarpetrevival.com.au", "phone": "0425 000 014", "address": "120 Collins St", "city": "Melbourne", "state": "VIC", "postcode": "3000"},
    {"company": "Geelong Hard Floor Specialists", "contact": "Deborah Young", "email": "deb@geelonghardfloor.com.au", "phone": "0426 000 015", "address": "77 Malop St", "city": "Geelong", "state": "VIC", "postcode": "3220"},
    {"company": "Southside Steam & Restore", "contact": "Nathan Reed", "email": "nathan@southsidesteam.com.au", "phone": "0427 000 016", "address": "19 Centre Rd", "city": "Bentleigh", "state": "VIC", "postcode": "3204"},
    {"company": "Ballarat Commercial Cleaners", "contact": "Melissa Hart", "email": "melissa@ballaratcommercial.com.au", "phone": "0428 000 017", "address": "44 Sturt St", "city": "Ballarat", "state": "VIC", "postcode": "3350"},
    # Western Australia
    {"company": "Perth Premium Carpet Care", "contact": "Shane Goodwin", "email": "shane@perthpremiumcarpet.com.au", "phone": "0429 000 018", "address": "15 St Georges Terrace", "city": "Perth", "state": "WA", "postcode": "6000"},
    {"company": "Fremantle Flood & Restoration", "contact": "Yvonne Cooper", "email": "yvonne@freocleaning.com.au", "phone": "0430 000 019", "address": "8 Marine Terrace", "city": "Fremantle", "state": "WA", "postcode": "6160"},
    {"company": "Bunbury Carpet & Upholstery Co", "contact": "Greg Fisher", "email": "greg@bunburycarpet.com.au", "phone": "0431 000 020", "address": "25 Victoria St", "city": "Bunbury", "state": "WA", "postcode": "6230"},
    # South Australia
    {"company": "Adelaide Carpet Specialists", "contact": "Carol Sutton", "email": "carol@adelaidecarpet.com.au", "phone": "0432 000 021", "address": "33 King William Rd", "city": "Adelaide", "state": "SA", "postcode": "5000"},
    {"company": "Mount Gambier Clean-Pro", "contact": "Kevin Doyle", "email": "kevin@mtgambiercleanpro.com.au", "phone": "0433 000 022", "address": "17 Commercial St", "city": "Mount Gambier", "state": "SA", "postcode": "5290"},
    # Tasmania / NT
    {"company": "Hobart Steam Clean Tasmania", "contact": "Rachel Barker", "email": "rachel@hobartsteam.com.au", "phone": "0434 000 023", "address": "45 Elizabeth St", "city": "Hobart", "state": "TAS", "postcode": "7000"},
    {"company": "Darwin Tropical Cleaning Services", "contact": "James Noa", "email": "james@darwintropical.com.au", "phone": "0435 000 024", "address": "28 Mitchell St", "city": "Darwin", "state": "NT", "postcode": "0800"},
    # Large accounts (hotel chains, strata)
    {"company": "National Strata Services Group", "contact": "Patricia Long", "email": "pat.long@nationalstrata.com.au", "phone": "1300 000 025", "address": "Level 12, 200 George St", "city": "Sydney", "state": "NSW", "postcode": "2000"},
    {"company": "CleanCo Australia (Franchise Group)", "contact": "Stewart Miles", "email": "stewart@cleanco.com.au", "phone": "1800 000 026", "address": "6 Innovation Ave", "city": "Notting Hill", "state": "VIC", "postcode": "3168"},
    {"company": "RestorePro Network", "contact": "Theresa Chan", "email": "theresa@restorepro.com.au", "phone": "1300 000 027", "address": "Unit 3, 88 Fullarton Rd", "city": "Norwood", "state": "SA", "postcode": "5067"},
    {"company": "Prestige Hotel Facilities Mgmt", "contact": "Oliver Grant", "email": "oliver@prestigehotels.com.au", "phone": "0436 000 028", "address": "1 Spencer St", "city": "Melbourne", "state": "VIC", "postcode": "3000"},
    {"company": "Benchmark Cleaning Supplies Distrib.", "contact": "Amy Tran", "email": "amy@benchmarksupplies.com.au", "phone": "0437 000 029", "address": "22 Logistics Lane", "city": "Acacia Ridge", "state": "QLD", "postcode": "4110"},
    {"company": "Crystal Clear Cleaning QLD", "contact": "Barry Hughes", "email": "barry@crystalclearqld.com.au", "phone": "0438 000 030", "address": "11 Trade Park Dr", "city": "Redbank Plains", "state": "QLD", "postcode": "4301"},
    {"company": "Metro Tile & Grout Restoration", "contact": "Nancy Bell", "email": "nancy@metrotile.com.au", "phone": "0439 000 031", "address": "7 Factory Rd", "city": "Dandenong", "state": "VIC", "postcode": "3175"},
    {"company": "Flood Response Australia", "contact": "Scott Adams", "email": "scott@floodresponse.com.au", "phone": "1800 000 032", "address": "45 Emergency Way", "city": "Chermside", "state": "QLD", "postcode": "4032"},
    {"company": "All-Surface Cleaning & Maintenance", "contact": "Jenny Park", "email": "jenny@allsurface.com.au", "phone": "0440 000 033", "address": "30 Commerce Dr", "city": "Burleigh Heads", "state": "QLD", "postcode": "4220"},
    {"company": "Regional Strata & Body Corp Clean", "contact": "Ian Mackay", "email": "ian@regionalstrata.com.au", "phone": "0441 000 034", "address": "15 Rural Way", "city": "Orange", "state": "NSW", "postcode": "2800"},
    {"company": "EcoClean Commercial Services", "contact": "Sophie Ellis", "email": "sophie@ecocleancommer.com.au", "phone": "0442 000 035", "address": "8 Green St", "city": "Byron Bay", "state": "NSW", "postcode": "2481"},
]


async def create_demo_user(db: AsyncSession) -> None:
    """Create demo admin user."""
    result = await db.execute(select(User).where(User.email == "admin@demo.com"))
    existing = result.scalar_one_or_none()
    if existing:
        print("[OK] Demo admin user already exists")
        return
    user = User(
        email="admin@demo.com",
        hashed_password="$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe",
        full_name="Demo Administrator",
        is_admin=True,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    print("[OK] Created demo admin user (admin@demo.com / demo123)")


async def create_cleaning_products(db: AsyncSession) -> list[Product]:
    """Create CCW cleaning equipment product catalogue."""
    products: list[Product] = []
    for category, items in CLEANING_PRODUCTS.items():
        for item in items:
            # Check for existing SKU to allow re-running
            result = await db.execute(select(Product).where(Product.sku == item["sku"]))
            if result.scalar_one_or_none():
                continue
            product = Product(
                sku=item["sku"],
                name=item["name"],
                description=f"{item['name']} — professional-grade cleaning equipment for Australian operators.",
                category=category,
                price=Decimal(str(item["price"])).quantize(Decimal("0.01")),
                cost=Decimal(str(item["cost"])).quantize(Decimal("0.01")),
                stock=item["stock"],
                warehouse_location=item["loc"],
                is_active=True,
            )
            products.append(product)
    if products:
        db.add_all(products)
        await db.commit()
    # Return all products (including pre-existing ones)
    result = await db.execute(
        select(Product).where(Product.sku.like("CCW-%"))
    )
    all_products = list(result.scalars().all())
    print(f"[OK] Products in catalogue: {len(all_products)} CCW cleaning products")
    return all_products


async def create_cleaning_customers(db: AsyncSession) -> list[Customer]:
    """Create cleaning-industry customer base."""
    customers: list[Customer] = []
    for i, c in enumerate(CLEANING_CUSTOMERS, start=1):
        customer_number = f"CCW-{i:05d}"
        result = await db.execute(
            select(Customer).where(Customer.customer_number == customer_number)
        )
        if result.scalar_one_or_none():
            continue
        customer = Customer(
            customer_number=customer_number,
            company_name=c["company"],
            contact_name=c["contact"],
            email=c["email"],
            phone=c["phone"],
            address=c["address"],
            city=c["city"],
            state=c["state"],
            postcode=c["postcode"],
            is_active=True,
        )
        customers.append(customer)
    if customers:
        db.add_all(customers)
        await db.commit()
    result = await db.execute(
        select(Customer).where(Customer.customer_number.like("CCW-%"))
    )
    all_customers = list(result.scalars().all())
    print(f"[OK] Customers in database: {len(all_customers)} cleaning-industry customers")
    return all_customers


async def create_orders(
    db: AsyncSession,
    customers: list[Customer],
    products: list[Product],
    count: int = 30,
) -> list[Order]:
    """Create sales orders reflecting cleaning-equipment purchasing patterns."""
    orders: list[Order] = []
    order_number = 30000
    now = datetime.now(UTC)

    # Check starting order number to avoid duplicates
    result = await db.execute(
        select(Order).where(Order.order_number.like("CCW-SO-%")).order_by(Order.order_number.desc())
    )
    existing = result.scalars().first()
    if existing and existing.order_number:
        try:
            order_number = int(existing.order_number.replace("CCW-SO-", "")) + 1
        except ValueError:
            pass

    for _ in range(count):
        days_ago = random.randint(0, 180)
        order_date = now - timedelta(days=days_ago)
        customer = random.choice(customers)

        if days_ago < 7:
            status = random.choice([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING])
        elif days_ago < 30:
            status = random.choice([OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED])
        else:
            status = random.choices(
                [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
                weights=[0.88, 0.12],
            )[0]

        order = Order(
            order_number=f"CCW-SO-{order_number:06d}",
            customer_id=customer.id,
            status=status,
            order_date=order_date,
            total=Decimal(0),
        )
        db.add(order)
        await db.flush()

        # Cleaning businesses typically order 1-5 items per order
        num_items = random.randint(1, 5)
        selected = random.sample(products, min(num_items, len(products)))
        subtotal = Decimal(0)

        for product in selected:
            quantity = random.randint(1, 4)
            unit_price = product.price
            line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))
            db.add(OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=unit_price,
                line_total=line_total,
            ))
            subtotal += line_total

        tax = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
        order.total = subtotal + tax
        orders.append(order)
        order_number += 1

    await db.commit()
    print(f"[OK] Created {len(orders)} orders with line items")
    return orders


async def create_quotes(
    db: AsyncSession,
    customers: list[Customer],
    products: list[Product],
    count: int = 18,
) -> list[Quote]:
    """Create quotes — mix of truckmount upgrades, chemical bulk buys, accessory kits."""
    quotes: list[Quote] = []
    quote_number = 40000
    now = datetime.now(UTC)

    result = await db.execute(
        select(Quote).where(Quote.quote_number.like("CCW-QT-%")).order_by(Quote.quote_number.desc())
    )
    existing = result.scalars().first()
    if existing and existing.quote_number:
        try:
            quote_number = int(existing.quote_number.replace("CCW-QT-", "")) + 1
        except ValueError:
            pass

    for _ in range(count):
        days_ago = random.randint(0, 90)
        quote_date = now - timedelta(days=days_ago)
        customer = random.choice(customers)
        status = random.choices(
            [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
            weights=[0.10, 0.30, 0.32, 0.08, 0.20],
        )[0]
        valid_until = quote_date + timedelta(days=30)

        quote = Quote(
            quote_number=f"CCW-QT-{quote_number:06d}",
            customer_id=customer.id,
            status=status,
            quote_date=quote_date,
            valid_until=valid_until,
            total=Decimal(0),
        )
        db.add(quote)
        await db.flush()

        num_items = random.randint(2, 7)
        selected = random.sample(products, min(num_items, len(products)))
        subtotal = Decimal(0)

        for product in selected:
            quantity = random.randint(1, 8)
            discount = random.choice([Decimal("1.0"), Decimal("0.97"), Decimal("0.95"), Decimal("0.92")])
            unit_price = (product.price * discount).quantize(Decimal("0.01"))
            line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))
            db.add(QuoteItem(
                quote_id=quote.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=unit_price,
                line_total=line_total,
            ))
            subtotal += line_total

        tax = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
        quote.total = subtotal + tax
        quotes.append(quote)
        quote_number += 1

    await db.commit()
    print(f"[OK] Created {len(quotes)} quotes with line items")
    return quotes


async def seed_cleaning_demo() -> None:
    """Main seeding function."""
    print("\n[SEED] CCW Cleaning Equipment Demo Data\n")
    print(f"       Database: {DATABASE_URL.split('@')[-1]}\n")

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    # Ensure tables exist (idempotent)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Database tables verified\n")

    async with async_session() as db:
        await create_demo_user(db)
        print()
        products = await create_cleaning_products(db)
        print()
        customers = await create_cleaning_customers(db)
        print()
        orders = await create_orders(db, customers, products, count=30)
        print()
        quotes = await create_quotes(db, customers, products, count=18)
        print()

    await engine.dispose()

    print("[SEED] CCW Cleaning Equipment demo data complete!\n")
    print("Summary:")
    print("  Login:     admin@demo.com / demo123")
    print(f"  Products:  {len(products)} cleaning equipment SKUs")
    print(f"  Customers: {len(customers)} cleaning-industry accounts")
    print(f"  Orders:    {len(orders)} orders (past 6 months)")
    print(f"  Quotes:    {len(quotes)} quotes")
    print()
    print("Product categories:")
    print("  - Truckmount cleaners (Prochem, Sapphire Scientific, Hydramaster)")
    print("  - Portable extractors & pressure washers (Mytee, Karcher, Alto)")
    print("  - Vacuums, blowers & floor machines (Nilfisk, i-mop, Dri-Eaz)")
    print("  - Cleaning chemicals (Prochem, Master Blend)")
    print("  - Hand tools, safety PPE & consumables")
    print()


if __name__ == "__main__":
    asyncio.run(seed_cleaning_demo())
