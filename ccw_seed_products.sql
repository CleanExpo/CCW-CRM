-- CCW Online Carpet Cleaning Products
-- Based on typical carpet cleaning warehouse inventory

-- First, update the ProductCategory enum to match CCW business
-- Categories: CLEANING_MACHINES, STEAM_CLEANERS, VACUUM_CLEANERS, CHEMICALS, ACCESSORIES, PARTS

-- Carpet Extractors & Cleaning Machines
INSERT INTO products (id, sku, name, description, category, price, cost, stock, warehouse_location, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'EXT-500', 'Commercial Carpet Extractor 500PSI', 'Heavy-duty commercial grade carpet extraction machine with 500PSI pump, 12-gallon solution tank, heated option available', 'ACCESSORIES', 3299.00, 2400.00, 5, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'EXT-1200', 'Portable Carpet Extractor Pro', 'Compact portable carpet extractor with 1200W motor, perfect for spot cleaning and upholstery', 'ACCESSORIES', 1899.00, 1350.00, 8, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'EXT-TRUCK', 'Truck Mount Carpet Extractor', 'Professional truck-mounted carpet cleaning system with dual vacuum motors and heated solution', 'ACCESSORIES', 15999.00, 12000.00, 2, 'Sydney Metro', true, NOW(), NOW()),
(gen_random_uuid(), 'EXT-AUTO', 'Auto Detail Extractor', 'Compact extractor designed for automotive interior cleaning, includes upholstery tool', 'ACCESSORIES', 899.00, 650.00, 12, 'Melbourne Central', true, NOW(), NOW());

-- Steam Cleaners
INSERT INTO products (id, sku, name, description, category, price, cost, stock, warehouse_location, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'STEAM-2000', 'Commercial Steam Cleaner 2000W', 'Industrial steam cleaner with continuous refill, 2000W heating element, kills 99.9% bacteria', 'ACCESSORIES', 1599.00, 1150.00, 6, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'STEAM-VAPOR', 'Vapor Steam Cleaner', 'Dry vapor steam system for sanitizing carpets, upholstery, and hard surfaces', 'ACCESSORIES', 2299.00, 1650.00, 4, 'Sydney Metro', true, NOW(), NOW()),
(gen_random_uuid(), 'STEAM-HANDHELD', 'Handheld Steam Cleaner', 'Portable handheld steam cleaner for spot cleaning and detail work', 'ACCESSORIES', 299.00, 215.00, 25, 'Brisbane Main', true, NOW(), NOW());

-- Vacuum Cleaners
INSERT INTO products (id, sku, name, description, category, price, cost, stock, warehouse_location, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'VAC-BACKPACK', 'Backpack Vacuum Cleaner Pro', 'Commercial backpack vacuum with HEPA filtration, 1400W motor, reduces fatigue', 'ACCESSORIES', 699.00, 500.00, 10, 'Melbourne Central', true, NOW(), NOW()),
(gen_random_uuid(), 'VAC-WET-DRY', 'Wet/Dry Vacuum 60L', '60-liter wet/dry vacuum with stainless steel tank, perfect for post-extraction cleanup', 'ACCESSORIES', 449.00, 320.00, 15, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'VAC-UPRIGHT', 'Commercial Upright Vacuum', 'Heavy-duty upright vacuum with dual motor system and 15-inch cleaning path', 'ACCESSORIES', 899.00, 650.00, 8, 'Sydney Metro', true, NOW(), NOW()),
(gen_random_uuid(), 'VAC-HEPA', 'HEPA Filtered Vacuum', 'True HEPA vacuum for allergen removal, ideal for healthcare and hospitality', 'ACCESSORIES', 1299.00, 950.00, 6, 'Brisbane Main', true, NOW(), NOW());

-- Cleaning Chemicals
INSERT INTO products (id, sku, name, description, category, price, cost, stock, warehouse_location, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'CHEM-SHAMPOO-5L', 'Carpet Shampoo Concentrate 5L', 'Heavy-duty carpet shampoo concentrate, makes 50L diluted solution, pleasant fresh scent', 'ACCESSORIES', 89.00, 55.00, 50, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'CHEM-SPOT-1L', 'Professional Spot Remover 1L', 'Fast-acting spot and stain remover for carpets and upholstery, removes coffee, wine, grease', 'ACCESSORIES', 34.00, 22.00, 80, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'CHEM-DEODOR-5L', 'Carpet Deodorizer 5L', 'Enzyme-based deodorizer eliminates odors at source, pet-safe formula', 'ACCESSORIES', 79.00, 48.00, 40, 'Melbourne Central', true, NOW(), NOW()),
(gen_random_uuid(), 'CHEM-PRETREAT-5L', 'Traffic Lane Pre-Treatment 5L', 'Pre-spray treatment for heavily soiled areas, breaks down oils and dirt', 'ACCESSORIES', 69.00, 42.00, 35, 'Sydney Metro', true, NOW(), NOW()),
(gen_random_uuid(), 'CHEM-RINSE-5L', 'Carpet Rinse Agent 5L', 'Neutralizing rinse agent removes detergent residue, prevents rapid resoiling', 'ACCESSORIES', 59.00, 38.00, 45, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'CHEM-PROTECTOR-5L', 'Carpet Protector 5L', 'Fluoropolymer-based carpet protector, repels stains and extends carpet life', 'ACCESSORIES', 149.00, 95.00, 30, 'Melbourne Central', true, NOW(), NOW()),
(gen_random_uuid(), 'CHEM-ENZYME-5L', 'Bio-Enzyme Cleaner 5L', 'Natural enzyme cleaner for organic stains, urine, vomit, ideal for pet odors', 'ACCESSORIES', 94.00, 60.00, 38, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'CHEM-UPHOLSTERY', 'Upholstery Shampoo 5L', 'Low-moisture upholstery cleaner for furniture and fabric, quick-dry formula', 'ACCESSORIES', 84.00, 52.00, 32, 'Sydney Metro', true, NOW(), NOW());

-- Accessories (Hoses, Wands, Brushes, Pads)
INSERT INTO products (id, sku, name, description, category, price, cost, stock, warehouse_location, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'ACC-HOSE-15M', 'Vacuum Hose 15m (2 inch)', 'Heavy-duty 2-inch vacuum hose, 15-meter length, crush-resistant', 'ACCESSORIES', 189.00, 125.00, 20, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'ACC-WAND-SET', 'Stainless Steel Wand Set', 'Professional 2-piece stainless steel wand set, 45cm sections, ergonomic grip', 'ACCESSORIES', 149.00, 95.00, 25, 'Melbourne Central', true, NOW(), NOW()),
(gen_random_uuid(), 'ACC-TOOL-UPHOLST', 'Upholstery Cleaning Tool', 'Wide-mouth upholstery tool with hand trigger, 15cm cleaning path', 'ACCESSORIES', 79.00, 50.00, 30, 'Sydney Metro', true, NOW(), NOW()),
(gen_random_uuid(), 'ACC-TOOL-STAIR', 'Stair Cleaning Tool', 'Compact stair tool with integrated brush, ideal for stairs and tight spaces', 'ACCESSORIES', 59.00, 38.00, 35, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'ACC-BRUSH-ROTARY', 'Rotary Carpet Brush 40cm', 'Power-driven rotary brush for agitating deep-set dirt, 40cm width', 'ACCESSORIES', 349.00, 240.00, 12, 'Melbourne Central', true, NOW(), NOW()),
(gen_random_uuid(), 'ACC-PAD-BUFF', 'Carpet Bonnet Pads (5 pack)', 'Absorbent bonnet pads for interim carpet maintenance, 40cm diameter, pack of 5', 'ACCESSORIES', 45.00, 28.00, 60, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'ACC-SPRAY-BOTTLE', 'Professional Spray Bottle 1L', 'Chemical-resistant spray bottle with adjustable nozzle, 1-liter capacity', 'ACCESSORIES', 12.00, 7.00, 150, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'ACC-GLOVES-BOX', 'Nitrile Gloves Box (100)', 'Chemical-resistant nitrile gloves, powder-free, box of 100', 'ACCESSORIES', 24.00, 15.00, 80, 'Melbourne Central', true, NOW(), NOW()),
(gen_random_uuid(), 'ACC-CAUTION-SIGNS', 'Wet Floor Caution Signs (4)', 'Yellow folding wet floor signs, set of 4, multilingual warning', 'ACCESSORIES', 39.00, 24.00, 50, 'Sydney Metro', true, NOW(), NOW());

-- Parts (Motors, Pumps, Filters)
INSERT INTO products (id, sku, name, description, category, price, cost, stock, warehouse_location, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'PART-MOTOR-VAC', 'Replacement Vacuum Motor 1400W', 'Universal vacuum motor 1400W, fits most commercial extractors', 'ACCESSORIES', 299.00, 195.00, 15, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'PART-PUMP-500', 'Solution Pump 500PSI', 'Replacement solution pump for carpet extractors, 500PSI rated', 'ACCESSORIES', 189.00, 125.00, 12, 'Sydney Metro', true, NOW(), NOW()),
(gen_random_uuid(), 'PART-FILTER-HEPA', 'HEPA Filter Replacement', 'Replacement HEPA filter for commercial vacuums, captures 99.97% particles', 'ACCESSORIES', 79.00, 48.00, 45, 'Melbourne Central', true, NOW(), NOW()),
(gen_random_uuid(), 'PART-FILTER-FOAM', 'Foam Pre-Filter (3 pack)', 'Washable foam pre-filters for wet/dry vacuums, pack of 3', 'ACCESSORIES', 29.00, 18.00, 70, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'PART-VALVE-CHECK', 'Check Valve Assembly', 'Replacement check valve for pump systems, prevents backflow', 'ACCESSORIES', 45.00, 28.00, 25, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'PART-SWITCH-PRESS', 'Pressure Switch', 'Adjustable pressure switch for pump control, 300-800 PSI range', 'ACCESSORIES', 65.00, 42.00, 20, 'Sydney Metro', true, NOW(), NOW()),
(gen_random_uuid(), 'PART-SEAL-KIT', 'Pump Seal Repair Kit', 'Complete seal kit for solution pumps, includes gaskets and O-rings', 'ACCESSORIES', 39.00, 24.00, 30, 'Melbourne Central', true, NOW(), NOW()),
(gen_random_uuid(), 'PART-HEATING-ELEM', 'Water Heating Element 1500W', 'Replacement heating element for heated extractors, 1500W stainless steel', 'ACCESSORIES', 149.00, 95.00, 10, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'PART-POWER-CORD', 'Heavy Duty Power Cord 15m', 'Industrial power cord with ground fault protection, 15-meter length', 'ACCESSORIES', 89.00, 55.00, 25, 'Sydney Metro', true, NOW(), NOW());

-- Professional Equipment Packages
INSERT INTO products (id, sku, name, description, category, price, cost, stock, warehouse_location, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'PKG-STARTER', 'Carpet Cleaning Starter Package', 'Complete starter package: portable extractor, wand set, chemicals (5L each), accessories', 'ACCESSORIES', 2499.00, 1800.00, 4, 'Brisbane Main', true, NOW(), NOW()),
(gen_random_uuid(), 'PKG-PRO', 'Professional Cleaning Package', 'Professional package: commercial extractor, vacuum, complete chemical set, all tools', 'ACCESSORIES', 4999.00, 3600.00, 2, 'Melbourne Central', true, NOW(), NOW());
