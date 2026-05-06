#!/bin/bash
# Manual test script for seeded account authentication

echo "Testing seeded account: seed_cust_367@demoapp.com"
echo "Password: Password123"
echo ""
echo "Step 1: Get session via Supabase Auth"

# Test direct Supabase auth (replace with your ngrok URL)
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eHhheHh4eHh4eHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2MzY2MzgwMDAsImV4cCI6MTk5OTk5OTk5OX0.Zr_7HBP1-u5CwCUX5-mDGkdX5XyXGDt5hI-hO0kzh9w"

echo "POST $SUPABASE_URL/auth/v1/token?grant_type=password"

curl -X POST \
  "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{
    "email": "seed_cust_367@demoapp.com",
    "password": "Password123"
  }' \
  -v

echo ""
echo ""
echo "If you get a token, use it to call the recommendations API:"
echo "curl -X POST http://localhost:3000/api/algorithms/recommendations \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer <ACCESS_TOKEN>' \\"
echo "  -d '{\"userId\": \"<USER_ID>\", \"limit\": 6}'"
