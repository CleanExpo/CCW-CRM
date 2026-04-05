#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         SSE Real-Time Event Publishing Test Script             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if backend is running
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "❌ Backend is not running at http://localhost:8000"
    echo "   Please start the backend first: cd backend && uvicorn src.api.main:app --reload"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Start SSE listeners
echo "📡 Starting SSE event listeners..."
echo ""

# Dashboard metrics stream
echo "   → Listening to dashboard-metrics stream..."
curl -N -H "Accept: text/event-stream" \
    http://localhost:8000/api/dashboard/metrics-stream 2>/dev/null | \
    while IFS= read -r line; do
        if [[ $line == data:* ]]; then
            echo "      [DASHBOARD-METRICS] ${line#data: }"
        fi
    done &
METRICS_PID=$!

# Dashboard activity stream  
echo "   → Listening to dashboard-activity stream (via metrics)..."
sleep 1

echo ""
echo "📤 Triggering test events by creating entities..."
echo ""

# Get first customer and product for testing
CUSTOMER_ID=$(curl -s "http://localhost:8000/api/demo/customers?page=1&page_size=1" | \
    python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data'][0]['id'])" 2>/dev/null)

PRODUCT_ID=$(curl -s "http://localhost:8000/api/demo/products?page=1&page_size=1" | \
    python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data'][0]['id'])" 2>/dev/null)

if [ -z "$CUSTOMER_ID" ] || [ -z "$PRODUCT_ID" ]; then
    echo "⚠️  Could not fetch customer/product IDs. Database might not be running."
    echo "   Starting Docker if needed: docker compose up -d"
    echo ""
    echo "   Waiting for events (10 seconds)..."
    sleep 10
else
    echo "   Customer ID: $CUSTOMER_ID"
    echo "   Product ID: $PRODUCT_ID"
    echo ""

    # Create a test order
    echo "1️⃣  Creating test order..."
    curl -s -X POST http://localhost:8000/api/orders \
        -H "Content-Type: application/json" \
        -d "{
            \"customer_id\": \"$CUSTOMER_ID\",
            \"status\": \"draft\",
            \"items\": [{
                \"product_id\": \"$PRODUCT_ID\",
                \"quantity\": 1
            }]
        }" > /dev/null 2>&1
    
    echo "   ✅ Order created - waiting for SSE event..."
    sleep 2

    # Create a test quote
    echo ""
    echo "2️⃣  Creating test quote..."
    curl -s -X POST http://localhost:8000/api/quotes \
        -H "Content-Type: application/json" \
        -d "{
            \"customer_id\": \"$CUSTOMER_ID\",
            \"status\": \"draft\",
            \"valid_until\": \"2026-03-01\",
            \"items\": [{
                \"product_id\": \"$PRODUCT_ID\",
                \"quantity\": 2
            }]
        }" > /dev/null 2>&1
    
    echo "   ✅ Quote created - waiting for SSE event..."
    sleep 2

    echo ""
    echo "3️⃣  Creating test customer..."
    RANDOM_NUM=$RANDOM
    curl -s -X POST http://localhost:8000/api/customers \
        -H "Content-Type: application/json" \
        -d "{
            \"customer_number\": \"TEST-$RANDOM_NUM\",
            \"company_name\": \"Test Company $RANDOM_NUM\",
            \"email\": \"test$RANDOM_NUM@example.com\"
        }" > /dev/null 2>&1
    
    echo "   ✅ Customer created - waiting for SSE event..."
    sleep 2

    echo ""
    echo "4️⃣  Creating test product..."
    curl -s -X POST http://localhost:8000/api/products \
        -H "Content-Type: application/json" \
        -d "{
            \"sku\": \"TEST-SKU-$RANDOM_NUM\",
            \"name\": \"Test Product $RANDOM_NUM\",
            \"price\": 99.99,
            \"stock\": 100,
            \"category\": \"accessories\"
        }" > /dev/null 2>&1
    
    echo "   ✅ Product created - waiting for SSE event..."
    sleep 3
fi

echo ""
echo "🛑 Stopping SSE listeners..."
kill $METRICS_PID 2>/dev/null

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     Test Complete                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "You should have seen SSE events for each created entity above."
echo "If no events appeared:"
echo "  1. Check that Docker/PostgreSQL is running: docker compose ps"
echo "  2. Check backend logs for errors"
echo "  3. Verify SSE endpoints are accessible: curl http://localhost:8000/api/dashboard/metrics-stream"
echo ""
