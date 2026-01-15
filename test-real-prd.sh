#!/bin/bash

# Test Real AI PRD Generation

API_URL="http://127.0.0.1:8000"
EMAIL="admin@demo.com"
PASSWORD="demo123"

echo "=== Testing Real AI PRD Generation ==="
echo ""

# Step 1: Login
echo "Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4)

echo "OK Logged in (User ID: $USER_ID)"
echo ""

# Step 2: Generate PRD with AI
echo "Step 2: Starting AI PRD generation..."
PRD_REQUEST='{
  "requirements": "Build a customer support ticketing system with ticket prioritization, assignment, SLA tracking, and customer satisfaction surveys",
  "context": {
    "project_type": "Web application",
    "priority": "high",
    "target_users": "Support agents and customers",
    "timeline": "4 months"
  }
}'

PRD_RESPONSE=$(curl -s -X POST "$API_URL/api/prd/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID" \
  -d "$PRD_REQUEST")

PRD_ID=$(echo "$PRD_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

echo "OK PRD generation started (ID: $PRD_ID)"
echo "NOTE: AI generation will take 1-2 minutes"
echo ""

# Step 3: Poll for completion
echo "Step 3: Monitoring AI progress (this may take a while)..."
MAX_ATTEMPTS=120  # 4 minutes max
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))

  STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/prd/$PRD_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-User-Id: $USER_ID")

  STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

  if [ "$STATUS" = "completed" ]; then
    echo ""
    echo "OK PRD generation completed!"
    echo ""
    echo "=== Results ==="
    echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    exit 0
  elif [ "$STATUS" = "failed" ]; then
    echo ""
    echo "ERROR: PRD generation failed"
    echo "$STATUS_RESPONSE"
    exit 1
  fi

  # Show progress every 10 seconds
  if [ $((ATTEMPT % 5)) -eq 0 ]; then
    echo "[$ATTEMPT/$MAX_ATTEMPTS] Status: $STATUS (elapsed: $((ATTEMPT * 2))s)"
  fi

  sleep 2
done

echo ""
echo "ERROR: Timeout waiting for PRD completion"
exit 1
