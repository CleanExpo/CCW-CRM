# API Documentation Guide

## Overview

The CCW ERP API provides comprehensive REST endpoints for managing products, orders, customers, inventory, and AI-powered features like semantic search and recommendations.

**Base URL (Development)**: http://localhost:8000
**Base URL (Production)**: https://api.ccw-erp.example.com

---

## Interactive Documentation

### Swagger UI

FastAPI automatically generates interactive API documentation:

**URL**: http://localhost:8000/docs

Features:
- Browse all endpoints organized by tags
- See request/response schemas
- Try out endpoints directly in the browser
- View example requests and responses
- Download OpenAPI schema

![Swagger UI Example](swagger-ui-example.png)

### ReDoc

Alternative documentation view with better reading experience:

**URL**: http://localhost:8000/redoc

Features:
- Clean, scrollable interface
- Search functionality
- Code samples in multiple languages
- Nested schema visualization

### OpenAPI Schema

Download the raw OpenAPI schema:

**URL**: http://localhost:8000/openapi.json

Use this with:
- Postman (import collection)
- Insomnia (import collection)
- Code generators (OpenAPI Generator, Swagger Codegen)
- API testing tools

---

## Authentication

### Getting a Token

**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "email": "admin@demo.com",
  "password": "demo123"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@demo.com",
    "full_name": "Admin User"
  }
}
```

### Using the Token

Include the token in the Authorization header for all authenticated requests:

```http
GET /api/products HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Expiry**: 24 hours

---

## API Endpoints by Category

### 🔐 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login with email and password |
| POST | /api/auth/logout | Logout (invalidate token) |
| GET | /api/auth/me | Get current user profile |

### 📦 Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/products | List all products (paginated) |
| GET | /api/products/{id} | Get product details |
| POST | /api/products | Create new product |
| PUT | /api/products/{id} | Update product |
| DELETE | /api/products/{id} | Delete product |

**Query Parameters (GET /api/products)**:
- `page` (int): Page number (default: 1)
- `page_size` (int): Items per page (default: 50, max: 100)
- `search` (string): Search by name or SKU
- `category` (string): Filter by category
- `is_active` (bool): Filter by active status

### 👥 Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/customers | List all customers (paginated) |
| GET | /api/customers/{id} | Get customer details |
| POST | /api/customers | Create new customer |
| PUT | /api/customers/{id} | Update customer |
| DELETE | /api/customers/{id} | Delete customer |

### 🛒 Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/orders | List all orders (paginated) |
| GET | /api/orders/{id} | Get order details with line items |
| POST | /api/orders | Create new order |
| PUT | /api/orders/{id} | Update order |
| PUT | /api/orders/{id}/status | Update order status |
| DELETE | /api/orders/{id} | Delete order |

**Order Statuses**: draft, pending, confirmed, processing, shipped, delivered, cancelled

### 📄 Quotes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/quotes | List all quotes (paginated) |
| GET | /api/quotes/{id} | Get quote details with line items |
| POST | /api/quotes | Create new quote |
| PUT | /api/quotes/{id} | Update quote |
| PUT | /api/quotes/{id}/status | Update quote status |
| POST | /api/quotes/{id}/convert | Convert quote to order |
| DELETE | /api/quotes/{id} | Delete quote |

**Quote Statuses**: draft, pending, sent, accepted, rejected, expired

### 🔍 AI Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/search/semantic | Semantic search with embeddings |
| GET | /api/search/hybrid | Hybrid search (vector + keyword) |
| POST | /api/search/ | Full search with all options |
| GET | /api/search/analytics | Search analytics and metrics |

**Search Example**:
```http
GET /api/search/semantic?query=power%20drill%20for%20concrete&language=en&limit=20
```

**Response**:
```json
{
  "success": true,
  "search_type": "semantic",
  "query": "power drill for concrete",
  "language": "en",
  "results": {
    "results": [
      {
        "product_id": "...",
        "sku": "PD-2000",
        "name": "Heavy Duty Concrete Drill",
        "similarity_score": 0.95,
        "price": 299.99,
        "stock": 45
      }
    ],
    "query_time_ms": 245
  }
}
```

### 🎯 AI Recommendations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/recommendations/similar/{product_id} | Similar products |
| GET | /api/recommendations/frequently-bought-together/{product_id} | Frequently bought together |
| GET | /api/recommendations/personalized/{customer_id} | Personalized for customer |
| POST | /api/recommendations/track-interaction | Track customer interaction |
| POST | /api/recommendations/precompute | Precompute recommendations |

**Recommendation Example**:
```http
GET /api/recommendations/similar/550e8400-e29b-41d4-a716-446655440001?language=en&limit=10
```

**Response**:
```json
{
  "success": true,
  "product_id": "550e8400-e29b-41d4-a716-446655440001",
  "recommendation_type": "similar",
  "language": "en",
  "recommendations": [
    {
      "product_id": "...",
      "sku": "PD-2100",
      "name": "Industrial Hammer Drill",
      "similarity_score": 0.89,
      "price": 349.99,
      "product_details": { /* full product object */ }
    }
  ],
  "query_time_ms": 15
}
```

### 🔌 Integrations

#### Shopify

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/integrations/shopify/connection | Connection status |
| POST | /api/integrations/shopify/sync/products | Sync products to Shopify |
| POST | /api/integrations/shopify/sync/inventory | Sync inventory levels |
| POST | /api/integrations/shopify/webhooks | Handle Shopify webhooks |

#### Google AP2 (Agent Payments Protocol)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/integrations/ap2/mandates/intent | Create intent mandate |
| POST | /api/integrations/ap2/mandates/cart | Create cart mandate |
| POST | /api/integrations/ap2/mandates/payment | Create payment mandate |
| POST | /api/integrations/ap2/voice/sessions | Create voice session |
| POST | /api/integrations/ap2/webhooks | Handle AP2 webhooks |
| GET | /api/integrations/ap2/connection | Connection status |

#### Xero

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/integrations/xero/connection | Connection status |
| POST | /api/integrations/xero/sync/invoices | Sync invoices to Xero |
| POST | /api/integrations/xero/sync/payments | Sync payments |

### 🤖 Autonomous Development

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/autonomous/projects | Create development project |
| GET | /api/autonomous/projects | List all projects |
| GET | /api/autonomous/projects/{id}/progress | Get project progress |
| POST | /api/autonomous/start | Start execution loop |
| POST | /api/autonomous/stop | Stop execution loop |
| GET | /api/autonomous/status | Get loop status |
| GET | /api/autonomous/agents/activity | Get agent activity |

### 🌍 Translations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/translations/languages | List supported languages |
| GET | /api/translations/products/{id} | Get product translations |
| POST | /api/translations/products/{id}/translate | Translate product |
| GET | /api/translations/ui/{namespace}/{language} | Get UI translations |

---

## Rate Limits

API endpoints have rate limits to prevent abuse:

| Category | Limit |
|----------|-------|
| Default | 100 requests/minute per IP |
| Authentication | 10 requests/minute per IP |
| Search | 60 requests/minute per user |
| Recommendations | 60 requests/minute per user |
| Integrations | 30 requests/minute per user |

**Rate Limit Headers**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642617600
```

**When rate limit is exceeded**:
```json
{
  "detail": "Rate limit exceeded: 100 per 1 minute",
  "status_code": 429,
  "retry_after": 45
}
```

---

## Error Handling

All errors return JSON with consistent format:

### 400 Bad Request
```json
{
  "detail": "Invalid request format",
  "status_code": 400,
  "type": "bad_request"
}
```

### 401 Unauthorized
```json
{
  "detail": "Authentication required",
  "status_code": 401,
  "type": "authentication_error"
}
```

### 404 Not Found
```json
{
  "detail": "Product not found",
  "status_code": 404,
  "type": "not_found"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "price"],
      "msg": "ensure this value is greater than 0",
      "type": "value_error.number.not_gt"
    }
  ],
  "status_code": 422,
  "type": "validation_error"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error",
  "status_code": 500,
  "type": "server_error"
}
```

---

## Pagination

List endpoints return paginated results:

**Request**:
```http
GET /api/products?page=2&page_size=25
```

**Response**:
```json
{
  "data": [
    { /* product 1 */ },
    { /* product 2 */ },
    // ... 25 products
  ],
  "total": 1000,
  "page": 2,
  "page_size": 25,
  "total_pages": 40
}
```

**Pagination Parameters**:
- `page`: Page number (min: 1, default: 1)
- `page_size`: Items per page (min: 1, max: 100, default: 50)

---

## Testing with Postman

### Import Collection

1. Download OpenAPI schema: http://localhost:8000/openapi.json
2. Open Postman → Import → Upload Files
3. Select `openapi.json`
4. Postman will create a collection with all endpoints

### Setup Environment

1. Create new environment: "CCW ERP - Dev"
2. Add variables:
   - `baseUrl`: http://localhost:8000
   - `token`: (leave empty, will be set after login)

### Login and Set Token

1. Send `POST /api/auth/login` request
2. Copy `access_token` from response
3. Go to Environment → Set `token` variable
4. Use `{{token}}` in Authorization headers

### Example Postman Request

```javascript
// Pre-request Script (set token)
pm.environment.set("token", pm.response.json().access_token);

// Test Script (validate response)
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});
```

---

## Code Examples

### Python (httpx)

```python
import httpx

# Login
response = httpx.post(
    "http://localhost:8000/api/auth/login",
    json={"email": "admin@demo.com", "password": "demo123"}
)
token = response.json()["access_token"]

# Search products
headers = {"Authorization": f"Bearer {token}"}
response = httpx.get(
    "http://localhost:8000/api/search/semantic",
    headers=headers,
    params={"query": "power drill", "language": "en", "limit": 10}
)
results = response.json()
```

### JavaScript (fetch)

```javascript
// Login
const loginResponse = await fetch('http://localhost:8000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@demo.com',
    password: 'demo123'
  })
});
const { access_token } = await loginResponse.json();

// Search products
const searchResponse = await fetch(
  'http://localhost:8000/api/search/semantic?query=power%20drill&language=en&limit=10',
  {
    headers: { 'Authorization': `Bearer ${access_token}` }
  }
);
const results = await searchResponse.json();
```

### cURL

```bash
# Login
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}' \
  | jq -r '.access_token')

# Search products
curl -X GET "http://localhost:8000/api/search/semantic?query=power%20drill&language=en&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Best Practices

### 1. Always Handle Errors

```javascript
try {
  const response = await apiClient.get('/api/products');
  // Process response
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 429) {
    // Rate limited - wait and retry
  } else {
    // Show error message
  }
}
```

### 2. Use Pagination for Large Datasets

```python
page = 1
all_products = []

while True:
    response = httpx.get(
        f"/api/products?page={page}&page_size=100",
        headers=headers
    )
    data = response.json()
    all_products.extend(data["data"])

    if page >= data["total_pages"]:
        break
    page += 1
```

### 3. Implement Token Refresh

```javascript
async function refreshToken() {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${oldToken}`
    }
  });
  const { access_token } = await response.json();
  localStorage.setItem('token', access_token);
  return access_token;
}
```

### 4. Respect Rate Limits

```javascript
class RateLimitedClient {
  constructor() {
    this.lastRequest = 0;
    this.minInterval = 1000; // 1 request per second
  }

  async request(url, options) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.minInterval) {
      await sleep(this.minInterval - timeSinceLastRequest);
    }

    this.lastRequest = Date.now();
    return fetch(url, options);
  }
}
```

---

## Support

For API support, contact:
- **Email**: support@ccw-erp.example.com
- **Documentation**: https://docs.ccw-erp.example.com
- **Status Page**: https://status.ccw-erp.example.com
