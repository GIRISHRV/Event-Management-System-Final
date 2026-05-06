# Seeded Account Authentication Troubleshooting

## Account Details
- **Email:** `seed_cust_367@demoapp.com`
- **Password:** `Password123`
- **Username:** `seed_cust_367`

## Issue Summary
Getting 401 on `/api/algorithms/recommendations` and 400/403 on proxy auth endpoints indicates the seeded account cannot authenticate through the ngrok Supabase instance.

## Diagnostic Steps

### 1. Verify Account Exists in Database
```sql
-- Connect to your local Supabase
SELECT id, email, username, role 
FROM public.profiles 
WHERE email = 'seed_cust_367@demoapp.com';

-- Check auth table
SELECT id, email 
FROM auth.users 
WHERE email = 'seed_cust_367@demoapp.com';
```

### 2. Check ngrok Tunnel Status
```powershell
# Verify ngrok is running and forwarding port 54321
netstat -ano | findstr "54321"

# Should see something like:
# TCP    0.0.0.0:54321    0.0.0.0:0    LISTENING
```

### 3. Test Auth Directly Against Local Supabase
```powershell
# Get your ANON KEY from .env.local (NEXT_PUBLIC_SUPABASE_ANON_KEY)
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eHhheHh4eHh4eHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2MzY2MzgwMDAsImV4cCI6MTk5OTk5OTk5OX0.Zr_7HBP1-u5CwCUX5-mDGkdX5XyXGDt5hI-hO0kzh9w"

$response = Invoke-WebRequest `
  -Uri "http://127.0.0.1:54321/auth/v1/token?grant_type=password" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "apikey" = $anonKey
  } `
  -Body (ConvertTo-Json @{
    "email" = "seed_cust_367@demoapp.com"
    "password" = "Password123"
  }) `
  -ErrorAction Stop

$jsonResponse = $response.Content | ConvertFrom-Json
$jsonResponse | ConvertTo-Json
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": { "id": "...", "email": "seed_cust_367@demoapp.com" }
}
```

### 4. Test Recommendations API with Token
If step 3 worked, use the access_token:

```powershell
# Extract the token from step 3 response
$token = $jsonResponse.access_token
$userId = $jsonResponse.user.id

$response = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/algorithms/recommendations" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
  } `
  -Body (ConvertTo-Json @{
    "userId" = $userId
    "limit" = 6
  }) `
  -ErrorAction Stop

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

## Common Causes

### 1. Seeded Accounts Not Created
**Check:** Run seed script
```bash
supabase db reset
# or
supabase migration up
```

### 2. ngrok Tunnel Down
**Fix:** Restart ngrok
```powershell
# Kill existing ngrok
Stop-Process -Name ngrok -Force

# Start new tunnel
npx ngrok http 54321
# Copy the new URL and update env vars
```

### 3. Wrong NEXT_PUBLIC_SUPABASE_URL in .env.local
**Check:** 
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321  (local)
# OR
NEXT_PUBLIC_SUPABASE_URL=https://<ngrok-url>.ngrok-free.dev  (for external access)
```

### 4. Proxy Auth Headers Not Forwarded
**Check:** Proxy route includes Authorization header
```typescript
// src/app/api/proxy/[...path]/route.ts
headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
```

## Debug Logs

### Enable Detailed Logging
1. **Frontend (Dev Tools)**
   - F12 → Console
   - Look for `[EventRecommendations]` logs
   - Check Network tab for failed requests

2. **Server Console**
   - Watch `npm run dev` output
   - Look for `[chat-history POST]` or `[Proxy]` logs

### Check Supabase Logs
```sql
-- View recent auth events
SELECT * FROM auth.audit_log_entries 
ORDER BY created_at DESC 
LIMIT 10;
```

## Quick Fixes

### Fix 1: Clear Session Storage and Re-login
```javascript
// In browser console
localStorage.clear()
sessionStorage.clear()
// Then refresh page and log in again
```

### Fix 2: Reset Seeded Password
If the hash is corrupted, reset the seed:
```bash
supabase db reset
npm run seed  # if custom script exists
```

### Fix 3: Manually Create Test Token
Use Supabase CLI to generate a token:
```bash
supabase status
# Get the JWT secret from output
# Then create a token with that secret
```

## Testing with cURL (Alternative)

```bash
# Get token
TOKEN_RESPONSE=$(curl -s -X POST \
  "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "email": "seed_cust_367@demoapp.com",
    "password": "Password123"
  }')

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

# Use token for API call
curl -X POST http://localhost:3000/api/algorithms/recommendations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"userId": "00000000-0000-4000-a000-000000000004", "limit": 6}'
```

## Success Indicators

✅ Token endpoint returns 200 with access_token
✅ Recommendations API returns 200 with recommendation data
✅ Dev server shows `POST /api/algorithms/recommendations 200`
✅ Browser console shows enriched events in recommendations

If you're still getting errors after these steps, collect:
1. Full error message from Network tab
2. Response body from failed request
3. Dev server logs at time of failure
4. Your current `.env.local` values (without secrets)
