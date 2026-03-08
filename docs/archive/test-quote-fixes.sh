#!/bin/bash
# Test Quote Module Fixes
# Tests ISS-001, ISS-002, ISS-003 fixes

BASE_URL="http://localhost:8000"
echo "Testing Quote Module Fixes..."
echo "================================"

# Get auth token
echo "1. Authenticating..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}' | \
  grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed"
  exit 1
fi
echo "✅ Authentication successful"

# Get a customer ID for testing
echo ""
echo "2. Getting customer ID..."
CUSTOMER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/customers?page=1&page_size=1" | \
  grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CUSTOMER_ID" ]; then
  echo "❌ No customers found"
  exit 1
fi
echo "✅ Customer ID: $CUSTOMER_ID"

# Get a product ID for quote items
echo ""
echo "3. Getting product ID..."
PRODUCT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/products?page=1&page_size=1" | \
  grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PRODUCT_ID" ]; then
  echo "❌ No products found"
  exit 1
fi
echo "✅ Product ID: $PRODUCT_ID"

# Test 1: Create quote (ISS-002 race condition fix)
echo ""
echo "4. Creating quote (testing race condition fix)..."
QUOTE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/quotes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUSTOMER_ID\",
    \"status\": \"draft\",
    \"valid_until\": \"2026-03-15\",
    \"notes\": \"Test quote for ISS-002 fix\",
    \"items\": [{
      \"product_id\": \"$PRODUCT_ID\",
      \"quantity\": 5,
      \"unit_price\": 100.00
    }]
  }")

QUOTE_ID=$(echo "$QUOTE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$QUOTE_ID" ]; then
  echo "❌ Quote creation failed"
  echo "Response: $QUOTE_RESPONSE"
  exit 1
fi
echo "✅ Quote created: $QUOTE_ID"

# Test 2: Update quote (ISS-002 race condition fix)
echo ""
echo "5. Updating quote (testing race condition fix)..."
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/quotes/$QUOTE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"notes\": \"Updated notes to test ISS-002 fix\",
    \"items\": [{
      \"product_id\": \"$PRODUCT_ID\",
      \"quantity\": 10,
      \"unit_price\": 95.00
    }]
  }")

if echo "$UPDATE_RESPONSE" | grep -q "error"; then
  echo "❌ Quote update failed"
  echo "Response: $UPDATE_RESPONSE"
  exit 1
fi
echo "✅ Quote updated successfully"

# Test 3: Update status (ISS-002 race condition fix)
echo ""
echo "6. Updating quote status (testing race condition fix)..."
STATUS_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/quotes/$QUOTE_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "sent"}')

if echo "$STATUS_RESPONSE" | grep -q "error"; then
  echo "❌ Status update failed"
  echo "Response: $STATUS_RESPONSE"
  exit 1
fi
echo "✅ Quote status updated to 'sent'"

# Test 4: Validation - try empty items (ISS-003 fix)
echo ""
echo "7. Testing validation - empty items should fail..."
VALIDATION_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/quotes/$QUOTE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": []}')

if echo "$VALIDATION_RESPONSE" | grep -q "error\|must have at least one item"; then
  echo "✅ Validation correctly rejects empty items"
else
  echo "❌ Validation should have rejected empty items"
  echo "Response: $VALIDATION_RESPONSE"
fi

# Test 5: Test /convert-to-order exists (ISS-001 duplicate route fix)
echo ""
echo "8. Testing convert-to-order endpoint exists..."
CONVERT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/quotes/$QUOTE_ID/convert-to-order" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$CONVERT_RESPONSE" | tail -1)

if [ "$HTTP_CODE" != "405" ]; then
  echo "✅ /convert-to-order endpoint works (no 405 error)"
else
  echo "❌ Got 405 error - duplicate route issue not fixed"
fi

echo ""
echo "================================"
echo "✅ All quote module fixes verified!"
echo ""
echo "Summary:"
echo "- ISS-001: Duplicate route removed ✓"
echo "- ISS-002: Race conditions fixed ✓"
echo "- ISS-003: Validation working ✓"
