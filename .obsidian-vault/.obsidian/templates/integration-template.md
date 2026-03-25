---
type: integration
id: INTEGRATION-{{INTEGRATION_NUMBER}}
name: { { INTEGRATION_NAME } }
provider: Cin7|Xero|Shopify|AP2|Stripe|Other
status: Active|Beta|Deprecated
config_file: apps/backend/src/config/{{FILE_NAME}}_settings.py
client_file: apps/backend/src/integrations/{{FILE_NAME}}/client.py
models_file: apps/backend/src/db/{{FILE_NAME}}_models.py
routes_prefix: /api/integrations/{{PREFIX}}
links:
  - '[[ROUTE-NNN]]'
  - '[[MODEL-NNN]]'
  - '[[PAGE-NNN]]'
last_verified: { { DATE } }
---

# INTEGRATION-{{INTEGRATION_NUMBER}}: {{INTEGRATION_NAME}}

## Overview

{{DESCRIPTION}}

<!-- AUTO-GENERATED -->

## Architecture

**Pattern**: Settings → Client (demo/live) → Routes → Frontend

```
config/{{FILE_NAME}}_settings.py
  ↓
integrations/{{FILE_NAME}}/client.py (demo/live routing)
  ↓
api/routes/integrations/{{FILE_NAME}}.py
  ↓
Frontend: lib/api/{{FILE_NAME}}.ts
```

## Configuration

**File**: `apps/backend/src/config/{{FILE_NAME}}_settings.py`

**Environment Variables**:

- `{{PREFIX}}_MODE`: demo|live
- `{{PREFIX}}_API_URL`: Base URL
- `{{PREFIX}}_API_KEY`: API key
- `{{PREFIX}}_API_SECRET`: API secret (if needed)

**Settings Class**:

```python
class {{INTEGRATION_NAME}}Settings(BaseSettings):
    mode: Literal["demo", "live"] = "demo"
    api_url: str = "https://api.{{PROVIDER}}.com"
    api_key: str = ""
    api_secret: str = ""
```

## Client Implementation

**File**: `apps/backend/src/integrations/{{FILE_NAME}}/client.py`

**Classes**:

- `{{INTEGRATION_NAME}}Client`: Main client (async context manager)
- `Demo{{INTEGRATION_NAME}}Client`: Mock data for demo mode

**Key Methods**:

```python
class {{INTEGRATION_NAME}}Client:
    async def __aenter__(self): ...
    async def __aexit__(self, ...): ...
    async def get_resource(self, resource_id: str): ...
    async def list_resources(self, params: dict): ...
    async def create_resource(self, data: dict): ...
    async def update_resource(self, resource_id: str, data: dict): ...
    async def delete_resource(self, resource_id: str): ...
```

## Database Models

**File**: `apps/backend/src/db/{{FILE_NAME}}_models.py`

**Tables**:

1. `{{PREFIX}}_connection`: Connection configuration
2. `{{PREFIX}}_{{ENTITY}}_mapping`: Entity ID mappings
3. `{{PREFIX}}_sync_log`: Sync history

**Key Models**:

- [[MODEL-NNN]]: Connection model
- [[MODEL-NNN]]: Mapping model
- [[MODEL-NNN]]: Sync log model

## API Routes

**File**: `apps/backend/src/api/routes/integrations/{{FILE_NAME}}.py`

**Endpoints**:

| Method | Path                                      | Purpose               | Route Doc     |
| ------ | ----------------------------------------- | --------------------- | ------------- |
| GET    | `/api/integrations/{{PREFIX}}/connection` | Get connection status | [[ROUTE-NNN]] |
| POST   | `/api/integrations/{{PREFIX}}/connection` | Create connection     | [[ROUTE-NNN]] |
| PUT    | `/api/integrations/{{PREFIX}}/connection` | Update connection     | [[ROUTE-NNN]] |
| DELETE | `/api/integrations/{{PREFIX}}/connection` | Delete connection     | [[ROUTE-NNN]] |
| POST   | `/api/integrations/{{PREFIX}}/sync`       | Trigger manual sync   | [[ROUTE-NNN]] |
| GET    | `/api/integrations/{{PREFIX}}/sync-logs`  | Get sync history      | [[ROUTE-NNN]] |

## Frontend Integration

**API Client**: `apps/web/lib/api/{{FILE_NAME}}.ts`

**Pages**:

- [[PAGE-NNN]]: Settings page for connection config
- [[PAGE-NNN]]: Dashboard for sync status

**Components**:

- [[COMPONENT-NNN]]: Connection card
- [[COMPONENT-NNN]]: Sync status widget

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Setup Guide

### Prerequisites

1. {{PROVIDER}} account with API access
2. API credentials (key + secret)
3. Webhook URL (if using webhooks)

### Configuration Steps

1. Set environment variables in `.env`:

   ```bash
   {{PREFIX}}_MODE=live
   {{PREFIX}}_API_URL=https://api.{{PROVIDER}}.com
   {{PREFIX}}_API_KEY=your_key
   {{PREFIX}}_API_SECRET=your_secret
   ```

2. Create connection via frontend:
   - Navigate to Settings → Integrations → {{INTEGRATION_NAME}}
   - Click "Connect"
   - Enter credentials
   - Test connection

3. Configure sync settings:
   - Select entities to sync
   - Set sync frequency
   - Enable/disable webhooks

### Testing in Demo Mode

Set `{{PREFIX}}_MODE=demo` to use mock data. Useful for:

- Development without API credentials
- Testing error scenarios
- Demo environments

## Sync Workflow

### Manual Sync

1. User clicks "Sync Now" button
2. Frontend calls `POST /api/integrations/{{PREFIX}}/sync`
3. Backend queues sync job
4. Worker processes:
   - Fetch data from {{PROVIDER}}
   - Transform to internal format
   - Update/create local records
   - Update mapping tables
   - Log sync result
5. Frontend polls `GET /api/integrations/{{PREFIX}}/sync-logs` for status

### Webhook Sync (if supported)

1. {{PROVIDER}} sends webhook to `/api/integrations/{{PREFIX}}/webhooks`
2. Backend validates webhook signature
3. Backend processes event:
   - Parse event data
   - Update affected records
   - Log webhook event
4. Frontend receives real-time update via SSE (if enabled)

## Data Mapping

### Entity Mappings

| Local Entity | {{PROVIDER}} Entity | Mapping Table                 |
| ------------ | ------------------- | ----------------------------- |
| Product      | {{PROVIDER_ENTITY}} | `{{PREFIX}}_product_mapping`  |
| Customer     | {{PROVIDER_ENTITY}} | `{{PREFIX}}_customer_mapping` |
| Order        | {{PROVIDER_ENTITY}} | `{{PREFIX}}_order_mapping`    |

### Field Mappings

**Product**:

- `products.sku` → `{{PROVIDER}}.SKU`
- `products.name` → `{{PROVIDER}}.Name`
- `products.price` → `{{PROVIDER}}.Price`

**Customer**:

- `customers.customer_number` → `{{PROVIDER}}.Code`
- `customers.email` → `{{PROVIDER}}.Email`

## Error Handling

### Common Errors

| Error            | Cause             | Resolution         |
| ---------------- | ----------------- | ------------------ |
| 401 Unauthorized | Invalid API key   | Update credentials |
| 429 Rate Limited | Too many requests | Retry with backoff |
| 404 Not Found    | Resource deleted  | Remove mapping     |

### Retry Strategy

- Automatic retry: 3 attempts with exponential backoff
- Transient errors (429, 5xx): Retry
- Permanent errors (404, 422): Log and skip

## Performance Considerations

- **Batch Size**: 50 records per API call
- **Concurrency**: 5 parallel requests max
- **Rate Limits**: {{N}} requests/minute
- **Caching**: Connection cached for 15 minutes

## Security

- API credentials stored encrypted in database
- Webhook signatures validated
- HTTPS required for all API calls
- Secrets never logged

## Monitoring

- Sync logs: `{{PREFIX}}_sync_log` table
- Metrics: Prometheus/Grafana (TODO)
- Alerts: Sentry for errors
- Health check: `GET /api/integrations/{{PREFIX}}/health`

## Known Issues

1. **Issue**: Description
   - **Workaround**: Temporary solution
   - **Fix planned**: When/How

## Testing

- Unit tests: `apps/backend/tests/integration/test_{{FILE_NAME}}.py`
- Integration tests: Uses demo mode client
- E2E tests: Frontend → Backend → Mock API

<!-- END HUMAN-CURATED -->

## Dependencies

**Python Packages**:

- `httpx`: Async HTTP client
- `pydantic`: Settings + validation
- `sqlalchemy`: Database models

**External APIs**:

- {{PROVIDER}} API v{{VERSION}}
- Rate limits: {{LIMITS}}
- Docs: https://docs.{{PROVIDER}}.com

## Related Integrations

- [[INTEGRATION-NNN]]: Related integration
- [[INTEGRATION-NNN]]: Depends on this integration

## Change History

| Date     | Change  | Author         |
| -------- | ------- | -------------- |
| {{DATE}} | Created | Auto-generated |
