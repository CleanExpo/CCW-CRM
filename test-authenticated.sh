#!/bin/bash
# Get token
RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@demo.com","password":"demo123"}')
TOKEN=$(echo $RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

echo "Token: ${TOKEN:0:50}..."
echo ""
echo "Testing authenticated endpoint:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/products | head -100
