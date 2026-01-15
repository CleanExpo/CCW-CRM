#!/bin/bash

# Quick test with API key authentication
BASE_URL="http://localhost:8002"
API_KEY="dev-test-api-key-12345"

echo "Testing endpoints with API key..."
echo ""

# Health check (no auth needed)
echo -n "Health: "
curl -s "$BASE_URL/health" | grep -q "healthy" && echo "PASS" || echo "FAIL"

# Orders endpoint (needs auth)
echo -n "GET /api/orders: "
response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$BASE_URL/api/orders")
http_code="${response: -3}"
[ "$http_code" = "200" ] && echo "PASS (HTTP $http_code)" || echo "FAIL (HTTP $http_code)"

# Suppliers endpoint
echo -n "GET /api/suppliers: "
response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$BASE_URL/api/suppliers")
http_code="${response: -3}"
[ "$http_code" = "200" ] && echo "PASS (HTTP $http_code)" || echo "FAIL (HTTP $http_code)"

# Purchase orders endpoint
echo -n "GET /api/purchase-orders: "
response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$BASE_URL/api/purchase-orders")
http_code="${response: -3}"
[ "$http_code" = "200" ] && echo "PASS (HTTP $http_code)" || echo "FAIL (HTTP $http_code)"

# Contact submissions endpoint
echo -n "GET /api/contact-submissions: "
response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$BASE_URL/api/contact-submissions")
http_code="${response: -3}"
[ "$http_code" = "200" ] && echo "PASS (HTTP $http_code)" || echo "FAIL (HTTP $http_code)"

# Demo requests endpoint
echo -n "GET /api/demo-requests: "
response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$BASE_URL/api/demo-requests")
http_code="${response: -3}"
[ "$http_code" = "200" ] && echo "PASS (HTTP $http_code)" || echo "FAIL (HTTP $http_code)"

# Inventory endpoint
echo -n "GET /api/inventory: "
response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$BASE_URL/api/inventory")
http_code="${response: -3}"
[ "$http_code" = "200" ] || [ "$http_code" = "404" ] && echo "Status: HTTP $http_code" || echo "FAIL (HTTP $http_code)"

echo ""
echo "Quick test complete!"
