#!/bin/bash

API_URL="http://127.0.0.1:8000"

# Authenticate
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Authentication failed"
  exit 1
fi

echo "✓ Authenticated"

# Get first customer
CUSTOMERS=$(curl -s -X GET "$API_URL/api/customers?page_size=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID")

CUSTOMER_ID=$(echo "$CUSTOMERS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✓ Customer ID: $CUSTOMER_ID"

# Get two products
PRODUCTS=$(curl -s -X GET "$API_URL/api/products?page_size=2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID")

PRODUCT_1=$(echo "$PRODUCTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
PRODUCT_2=$(echo "$PRODUCTS" | grep -o '"id":"[^"]*"' | head -2 | tail -1 | cut -d'"' -f4)

echo "✓ Product 1: $PRODUCT_1"
echo "✓ Product 2: $PRODUCT_2"

# Create quote
QUOTE_DATA="{
  \"customer_id\": \"$CUSTOMER_ID\",
  \"items\": [
    {\"product_id\": \"$PRODUCT_1\", \"quantity\": 2},
    {\"product_id\": \"$PRODUCT_2\", \"quantity\": 3}
  ],
  \"notes\": \"Test quote\",
  \"valid_until\": \"2026-02-28T00:00:00Z\"
}"

echo ""
echo "Creating quote..."
QUOTE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/quotes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID" \
  -d "$QUOTE_DATA")

STATUS=$(echo "$QUOTE_RESPONSE" | tail -1)
BODY=$(echo "$QUOTE_RESPONSE" | head -n-1)

echo "HTTP Status: $STATUS"
echo "Response: $BODY"

if [ "$STATUS" = "201" ]; then
  echo ""
  echo "✅ SUCCESS - Quote created!"
  QUOTE_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Quote ID: $QUOTE_ID"
else
  echo ""
  echo "❌ FAILED - Quote creation failed"
  exit 1
fi
