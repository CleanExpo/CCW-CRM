# Enhanced Shopify Integration - Implementation Plan

**Phase:** Shopify Enhancement
**Date:** February 3, 2026
**Status:** Planning
**Priority:** High (Business-Critical E-commerce Integration)

---

## 🎯 Executive Summary

CCW-Online ERP already has comprehensive Shopify integration (ISS-008, ISS-009, ISS-010 complete). This phase enhances it with:

1. **Custom Metafields** - Already implemented, needs expansion
2. **Real-Time Bidirectional Inventory Sync** - Partially implemented, needs enhancement
3. **Multi-Language Product Sync** - NEW FEATURE (leverage Phase 1 translations)

---

## 📊 Current State Assessment

### ✅ Already Implemented (Strong Foundation)

**Shopify Integration Files:**
- `apps/backend/src/integrations/shopify/client.py` - API client
- `apps/backend/src/integrations/shopify/metafields.py` - Custom metafields (6 defined)
- `apps/backend/src/integrations/shopify/product_sync.py` - Bidirectional product sync
- `apps/backend/src/integrations/shopify/inventory_sync.py` - Inventory synchronization
- `apps/backend/src/integrations/shopify/inventory.py` - Inventory management
- `apps/backend/src/integrations/shopify/orders.py` - Order import
- `apps/backend/src/integrations/shopify/webhooks.py` - Webhook handling

**Existing Features:**
- ✅ Shopify authentication (OAuth)
- ✅ Product sync ERP → Shopify
- ✅ Product import Shopify → ERP
- ✅ Conflict resolution (newest_wins, erp_wins, shopify_wins, manual)
- ✅ Order import from Shopify
- ✅ Inventory sync (manual + webhook triggers)
- ✅ Webhook handlers for products, orders, inventory
- ✅ 6 custom metafields (compliance, specs, warehouse, supplier, maintenance, stock_alert)

**Database Models:**
- `ShopifyConnection` - Connection settings
- `ShopifyProductMapping` - Product ID mapping
- `ShopifyProductSyncLog` - Sync history
- `ShopifyMetafield` - Metafield storage
- `ShopifyWebhook` - Webhook registration

---

## ❌ What Needs Enhancement

### 1. Custom Metafields - Expand & Automate

**Current State:**
- 6 metafields defined: compliance, specifications, warehouse_location, supplier_info, maintenance_guide, stock_alert_threshold
- Manual sync only (no automatic sync on product update)
- No bulk sync utility

**What's Missing:**
- Automatic metafield sync when product updated in ERP
- Bulk metafield sync for all products
- Additional metafield types (dimensions, weight, brand, certification_expiry)
- Metafield validation before sync
- Retry logic for failed metafield updates

**Enhancement Plan:**
- Add 4 new metafields (dimensions, weight_kg, brand, certification_expiry_date)
- Integrate metafield sync into product update endpoint
- Create bulk sync endpoint `/api/integrations/shopify/metafields/sync-all`
- Add SSE events for metafield sync progress

### 2. Real-Time Bidirectional Inventory Sync - Enhance

**Current State:**
- Manual sync endpoints exist: `/inventory/sync-to-shopify/{product_id}`, `/inventory/sync-from-shopify/{product_id}`
- Webhook support for inventory updates
- Single-location sync

**What's Missing:**
- **Automatic sync** when stock changes in ERP (no SSE integration)
- **Multi-location sync** (Brisbane, Sydney, Melbourne → Shopify total)
- **Conflict resolution** for concurrent updates
- **Batch sync** for better performance
- **Retry queue** for failed syncs
- **Sync status dashboard**

**Enhancement Plan:**
- Integrate with Phase 5 SSE inventory events
- Automatically sync to Shopify when stock changes in ERP
- Aggregate multi-location stock before syncing
- Create sync queue for reliability
- Add sync health monitoring dashboard

### 3. Multi-Language Product Sync - NEW FEATURE ⭐

**Current State:**
- Phase 1 implemented translations system with 10 languages
- Translation database with product translations
- AI-powered translation via Ollama
- NO Shopify multi-language integration

**What's Missing:**
- Shopify Markets multi-language API integration
- Sync product translations to Shopify (name, description, tags)
- Bidirectional translation sync (ERP ↔ Shopify)
- Language-specific metafields
- Translation conflict resolution

**Enhancement Plan:**
- Create `ShopifyTranslationSyncer` class
- Sync product name + description in 10 languages
- Use Shopify GraphQL Translations API
- Bidirectional sync (ERP → Shopify, Shopify → ERP)
- Fallback to AI translation for missing languages

---

## 📋 Detailed Implementation Plan

### Phase 1: Enhanced Metafields (6 hours)

**Task 1.1: Add New Metafield Types** (2h)
- Add to `METAFIELD_DEFINITIONS`:
  - `dimensions` (JSON): `{ length, width, height, unit }`
  - `weight_kg` (number_decimal): Product weight in kg
  - `brand` (single_line_text_field): Brand name
  - `certification_expiry` (date): Certification expiration date
- Update `MetafieldManager.sync_product_metafields()` to include new fields

**Task 1.2: Automatic Metafield Sync** (3h)
- Hook into product update endpoint (`apps/backend/src/api/routes/products.py`)
- After product update, check if Shopify mapping exists
- If exists, trigger metafield sync automatically
- Add SSE event publishing for sync progress

**Task 1.3: Bulk Metafield Sync** (1h)
- Create endpoint: `POST /api/integrations/shopify/metafields/sync-all`
- Batch process all products with Shopify mappings
- Return progress updates via SSE

**Files to Modify:**
- `apps/backend/src/integrations/shopify/metafields.py`
- `apps/backend/src/api/routes/products.py`
- `apps/backend/src/api/routes/integrations/shopify.py`

---

### Phase 2: Real-Time Bidirectional Inventory Sync (8 hours)

**Task 2.1: SSE Integration** (3h)
- Hook into Phase 5 inventory SSE events
- When stock changes in ERP (adjustment, transfer), trigger Shopify sync
- Create `sync_to_shopify_on_inventory_change()` function
- Add to inventory_stream.py event publishers

**Task 2.2: Multi-Location Aggregation** (2h)
- Modify `InventorySyncService` to aggregate multi-location stock
- Sum stock across Brisbane, Sydney, Melbourne
- Sync total to Shopify
- Add location-specific notes in metafield

**Task 2.3: Sync Queue & Retry Logic** (2h)
- Create `ShopifyInventorySyncQueue` table
- Queue failed syncs with retry count
- Background worker to process queue (every 5 minutes)
- Exponential backoff for retries

**Task 2.4: Sync Health Dashboard** (1h)
- Create endpoint: `GET /api/integrations/shopify/inventory/sync-status`
- Return: pending syncs, failed syncs, last sync time, success rate
- Add widget to dashboard

**Files to Modify:**
- `apps/backend/src/integrations/shopify/inventory_sync.py`
- `apps/backend/src/api/routes/inventory_stream.py`
- `apps/backend/src/db/shopify_models.py` (add SyncQueue table)
- `apps/web/components/dashboard/ShopifySyncHealthWidget.tsx` (new)

---

### Phase 3: Multi-Language Product Sync (12 hours)

**Task 3.1: Shopify GraphQL Translations API Client** (3h)
- Create `ShopifyTranslationClient` class
- Implement GraphQL mutation: `translationsRegister`
- Implement GraphQL query: `translations`
- Handle Shopify Markets language codes (EN, ES, FR, etc.)

**Task 3.2: Translation Syncer** (4h)
- Create `ShopifyTranslationSyncer` class in `apps/backend/src/integrations/shopify/translations.py`
- Method: `sync_product_translations_to_shopify(product_id, languages)`
- Fetch translations from ERP translations table
- Map to Shopify GraphQL format
- Batch register translations (max 10 languages per request)

**Task 3.3: Bidirectional Sync** (3h)
- Method: `sync_translations_from_shopify(shopify_product_id)`
- Fetch Shopify product translations
- Compare with ERP translations
- Apply conflict resolution (newest_wins)
- Update ERP translation table

**Task 3.4: API Endpoints** (2h)
- `POST /api/integrations/shopify/translations/sync-to-shopify/{product_id}`
- `POST /api/integrations/shopify/translations/sync-from-shopify/{shopify_product_id}`
- `POST /api/integrations/shopify/translations/sync-all` (bulk)
- Add to product sync flow (automatic)

**Files to Create:**
- `apps/backend/src/integrations/shopify/translations.py` (new)
- `apps/backend/src/integrations/shopify/graphql_client.py` (new, GraphQL support)

**Files to Modify:**
- `apps/backend/src/integrations/shopify/product_sync.py`
- `apps/backend/src/api/routes/integrations/shopify.py`

---

## 🔧 Technical Architecture

### Multi-Language Sync Flow

```
ERP Product Update
    ↓
Trigger translation sync
    ↓
Fetch translations (10 languages) from `translations` table
    ↓
Map to Shopify GraphQL format:
{
  "resourceId": "gid://shopify/Product/123",
  "translations": [
    { "locale": "es", "key": "title", "value": "Taladro Industrial" },
    { "locale": "fr", "key": "title", "value": "Perceuse Industrielle" },
    { "locale": "es", "key": "description", "value": "..." }
  ]
}
    ↓
Call Shopify GraphQL mutation: translationsRegister
    ↓
Log sync result in ShopifyProductSyncLog
    ↓
Publish SSE event: translation_synced
```

### Real-Time Inventory Sync Flow

```
ERP Stock Change (adjustment, transfer)
    ↓
Phase 5 SSE event published: inventory-updates
    ↓
InventorySyncService listens to SSE
    ↓
Aggregate stock across locations (Brisbane + Sydney + Melbourne)
    ↓
Call Shopify Inventory API:
PUT /admin/api/2024-01/inventory_levels/set.json
{
  "location_id": 123,
  "inventory_item_id": 456,
  "available": 150  # total from all locations
}
    ↓
If success: Log sync, publish SSE event
If fail: Add to retry queue
```

---

## 📊 Success Metrics

### Metafields
- ✅ 10 metafield types synced (up from 6)
- ✅ Automatic sync on product update (no manual trigger)
- ✅ <1s sync latency for metafields

### Inventory Sync
- ✅ 100% automatic sync (no manual button needed)
- ✅ <2s sync latency (ERP change → Shopify update)
- ✅ 99%+ sync success rate (with retry queue)
- ✅ Multi-location aggregation working

### Multi-Language
- ✅ 10 languages synced to Shopify
- ✅ Bidirectional sync (ERP ↔ Shopify)
- ✅ Translation conflict resolution working
- ✅ <5s sync latency for all languages

---

## 🚨 Risks & Mitigation

### Risk 1: Shopify API Rate Limits
- **Impact**: Bulk syncs could hit rate limits (40 req/s)
- **Mitigation**: Implement rate limiting, batch requests, use GraphQL
- **Fallback**: Queue system with exponential backoff

### Risk 2: Translation Quality
- **Impact**: AI translations may not be perfect for e-commerce
- **Mitigation**: Manual review dashboard, flag low-confidence translations
- **Fallback**: Allow manual translation overrides

### Risk 3: Sync Conflicts
- **Impact**: Concurrent updates in ERP and Shopify could conflict
- **Mitigation**: Conflict resolution strategies (newest_wins default)
- **Fallback**: Manual conflict resolution UI

### Risk 4: Multi-Location Stock Complexity
- **Impact**: Aggregating multi-location stock could confuse customers
- **Mitigation**: Add location notes in metafield, show "Ships from nearest location"
- **Fallback**: Allow per-location inventory sync (advanced mode)

---

## 🎯 Implementation Order

**Week 1:**
1. Enhanced Metafields (6h) - Quick win
2. Real-Time Inventory Sync (8h) - High impact

**Week 2:**
3. Multi-Language Sync (12h) - New feature

**Total Effort:** 26 hours (~4 days)

---

## 📝 Testing Plan

### Metafields Testing
1. Create product in ERP with all 10 metafields
2. Sync to Shopify, verify all metafields present
3. Update product in ERP, verify automatic sync
4. Bulk sync all products, verify progress

### Inventory Sync Testing
1. Adjust stock in Brisbane, verify Shopify updates automatically
2. Transfer stock Sydney → Melbourne, verify Shopify total updates
3. Simulate Shopify rate limit, verify retry queue works
4. Check sync health dashboard shows correct status

### Multi-Language Testing
1. Create product with 10 language translations
2. Sync to Shopify, verify all languages in Shopify admin
3. Update translation in Shopify, sync to ERP, verify bidirectional
4. Test conflict resolution (concurrent updates)

---

## 🔗 Integration with Existing Systems

### Phase 1 (i18n) Integration
- Leverage existing `translations` table
- Use existing `TranslationService` for AI translations
- Map languages: ERP codes → Shopify locale codes

### Phase 5 (SSE) Integration
- Hook into `inventory-updates` SSE channel
- Subscribe to stock changes
- Trigger Shopify sync automatically

### Existing Shopify Integration
- Extend `BidirectionalProductSyncer` for translations
- Enhance `InventorySyncService` for real-time
- Expand `MetafieldManager` for new fields

---

**END OF PLAN**

Ready to start implementation!
