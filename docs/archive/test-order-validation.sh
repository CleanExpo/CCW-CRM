#!/bin/bash

API_URL="http://127.0.0.1:8000"

echo "Testing Order Creation Validation Fix"
echo "======================================"
echo ""

# Authenticate
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed"
  exit 1
fi
echo "✅ Authenticated"
echo ""

# Get a valid product
PRODUCT_RESPONSE=$(curl -s -X GET "$API_URL/api/products?page_size=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID")

PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ Valid Product ID: $PRODUCT_ID"
echo ""

# Test 1: Order with non-existent customer (should return 404)
echo "Test 1: Order with non-existent customer"
echo "-----------------------------------------"
ORDER_DATA='{
  "customer_id": "00000000-0000-0000-0000-000000000000",
  "items": [
    {"product_id": "'$PRODUCT_ID'", "quantity": 1}
  ],
  "status": "draft"
}'

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID" \
  -d "$ORDER_DATA")

STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $STATUS"
echo "Response: $BODY"

if [ "$STATUS" = "404" ]; then
  echo "✅ PASS: Returns 404 for non-existent customer"
elif [ "$STATUS" = "500" ]; then
  echo "❌ FAIL: Still returns 500 (bug not fixed)"
  exit 1
else
  echo "⚠️  UNEXPECTED: Got HTTP $STATUS"
fi
echo ""

# Test 2: Order with valid customer (should succeed)
echo "Test 2: Order with valid customer"
echo "---------------------------------"

# Get a valid customer
CUSTOMER_RESPONSE=$(curl -s -X GET "$API_URL/api/customers?page_size=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID")

CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Valid Customer ID: $CUSTOMER_ID"

ORDER_DATA='{
  "customer_id": "'$CUSTOMER_ID'",
  "items": [
    {"product_id": "'$PRODUCT_ID'", "quantity": 1}
  ],
  "status": "draft"
}'

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID" \
  -d "$ORDER_DATA")

STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $STATUS"
echo "Response Body: $BODY"

if [ "$STATUS" = "201" ]; then
  ORDER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "✅ PASS: Order created successfully (ID: $ORDER_ID)"
else
  echo "❌ FAIL: Expected 201, got $STATUS"
  exit 1
fi
echo ""

echo "======================================"
echo "✅ All tests passed! Bug is fixed."
echo "======================================"
