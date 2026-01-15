#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://127.0.0.1:8000"
EMAIL="admin@demo.com"
PASSWORD="demo123"

echo "=== PRD Generation Test ==="
echo ""

# Step 1: Login
echo -e "${YELLOW}Step 1: Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Login response: $LOGIN_RESPONSE"

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}ERROR: Failed to get token${NC}"
  exit 1
fi

echo -e "${GREEN}OK Logged in successfully${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Extract user_id from token (decode JWT payload)
PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
# Add padding if needed
MOD=$((${#PAYLOAD} % 4))
if [ $MOD -ne 0 ]; then
  PAYLOAD="${PAYLOAD}$(printf '=%.0s' $(seq 1 $((4 - MOD))))"
fi
USER_ID=$(echo "$PAYLOAD" | base64 -d 2>/dev/null | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4)

echo "User ID: $USER_ID"
echo ""

# Step 2: Generate PRD
echo -e "${YELLOW}Step 2: Starting PRD generation...${NC}"
PRD_REQUEST='{
  "requirements": "Build an inventory management system with real-time stock tracking, low stock alerts, and warehouse location management",
  "context": {
    "project_type": "ERP module",
    "priority": "high"
  }
}'

PRD_RESPONSE=$(curl -s -X POST "$API_URL/api/prd/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID" \
  -d "$PRD_REQUEST")

echo "PRD response: $PRD_RESPONSE"

PRD_ID=$(echo "$PRD_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PRD_ID" ]; then
  echo -e "${RED}ERROR: Failed to start PRD generation${NC}"
  exit 1
fi

echo -e "${GREEN}OK PRD generation started${NC}"
echo "PRD ID: $PRD_ID"
echo ""

# Step 3: Poll for completion
echo -e "${YELLOW}Step 3: Monitoring progress...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))

  STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/prd/$PRD_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-User-Id: $USER_ID")

  STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

  echo "[$ATTEMPT/$MAX_ATTEMPTS] Status: $STATUS"

  if [ "$STATUS" = "completed" ]; then
    echo -e "${GREEN}OK PRD generation completed!${NC}"
    echo ""
    echo "=== Results ==="
    echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    exit 0
  elif [ "$STATUS" = "failed" ]; then
    echo -e "${RED}ERROR: PRD generation failed${NC}"
    echo "$STATUS_RESPONSE"
    exit 1
  fi

  sleep 2
done

echo -e "${RED}ERROR: Timeout waiting for PRD completion${NC}"
exit 1
