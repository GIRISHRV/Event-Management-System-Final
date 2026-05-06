# API 500 Error Fixes - May 6, 2026

## Issues Found

### 1. **500 on `/api/proxy/rest/v1/algorithm_results`**
- **Root Cause**: RLS policies with complex subqueries that could fail
- **Symptoms**: When querying `algorithm_results?user_id=eq.b43d5810...&algorithm_type=in.(xsimgcl,gnn-cf)`
- **Fix**: Simplified RLS policies to use direct UID checks first, then EXISTS subqueries

### 2. **500 on `/api/chat-history` POST**
- **Root Cause**: Database constraint violations or RLS policy issues not being properly logged
- **Symptoms**: Error "Failed to commit state: APIError: Request failed with status 500"
- **Fixes**: 
  - Added `.select().single()` to insert/update to ensure proper response handling
  - Enhanced error logging with full error details (code, message, details, hint)
  - Better type safety for message validation

### 3. **Chart Width/Height Error**
- **Root Cause**: Dashboard loading algorithm results but charts rendering before data loads
- **Related To**: The 500 errors preventing data from loading, causing empty chart state
- **Resolution**: Will be fixed once algorithm_results queries succeed

## Applied Fixes

### Migration: `supabase/migrations/20250506_fix_algorithm_results_rls.sql`

This migration:
1. **Fixes algorithm_results RLS**:
   - Changed SELECT policy from subquery to direct auth.uid() check first
   - Uses EXISTS for admin check as fallback
   - More efficient and less likely to fail

2. **Fixes chat_history RLS**:
   - Simplified policies for direct UID matching
   - Added missing DELETE policy
   - Consistent policy structure

### Code Changes: `src/app/api/chat-history/route.ts`

Enhanced POST handler:
- Now uses `.select().single()` on insert/update for proper response validation
- Logs full error object with: code, message, details, hint
- Better debugging when RLS policies or constraints fail
- Validates payload contents before DB operations

## How to Apply

### Method 1: Via Supabase CLI
```bash
supabase migration up
```

### Method 2: Manual SQL
1. Connect to local Supabase
2. Open SQL Editor or psql
3. Copy the contents of `supabase/migrations/20250506_fix_algorithm_results_rls.sql`
4. Execute the migration

### Method 3: Via pgAdmin
1. Open pgAdmin (http://localhost:5050)
2. Navigate to local Supabase database
3. Query tool → Paste and execute migration SQL

## Testing After Migration

### 1. Test Algorithm Results Query
```powershell
$token = "eyJhbGciOiJFUzI1..."  # Your JWT token from earlier

curl -X GET "http://127.0.0.1:54321/rest/v1/algorithm_results?user_id=eq.b43d5810-379d-4ef4-9435-ad61f4af2978" `
  -H "Authorization: Bearer $token" `
  -H "apikey: eyJhbGciOiJIUzI1NiI..."
```

Expected: 200 response with algorithm results or empty array `[]`

### 2. Test Chat History POST
```powershell
$token = "eyJhbGciOiJFUzI1..."

curl -X POST http://localhost:3000/api/chat-history `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{
    "eventId": "d76a6bc1-4a06-41b5-8e80-84c8b0518e27",
    "message": {"role":"user","content":"Test message"}
  }'
```

Expected: 200 response with `{"success":true,"message":"Messages saved to database","totalMessages":1}`

### 3. Test Dashboard
1. Sign in as seed_cust_367@demoapp.com / Password123
2. Navigate to customer dashboard
3. Check browser console for any 500 errors
4. Verify recommendations load
5. Verify chat works
6. Verify algorithm charts render

## Debugging Remaining Issues

If you still see 500 errors after migration:

### Check RLS Policies
```sql
SELECT tablename, policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename IN ('algorithm_results', 'chat_history')
ORDER BY tablename, policyname;
```

### Check Table Structure
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('algorithm_results', 'chat_history')
ORDER BY table_name, ordinal_position;
```

### Check Constraints
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name IN ('algorithm_results', 'chat_history');
```

### View Recent Error Logs
```sql
SELECT * FROM auth.audit_log_entries 
ORDER BY created_at DESC 
LIMIT 20;
```

## Expected Behavior After Fix

✅ Algorithms can query their own results
✅ Chat messages save without 500 errors
✅ Dashboard charts render with data
✅ User recommendations display correctly
✅ Browser console is clean (no API errors)

## If Issues Persist

1. **Check ngrok tunnel** - Is it still running and forwarding to port 54321?
   ```bash
   netstat -ano | findstr "54321"
   ```

2. **Restart dev server**
   ```bash
   npm run dev
   ```

3. **Check .env.local**
   - NEXT_PUBLIC_SUPABASE_URL should point to ngrok URL or http://127.0.0.1:54321
   - NEXT_PUBLIC_SUPABASE_ANON_KEY must be set

4. **Review server logs** during test - Look for `[chat-history POST]` or `[Proxy]` logs

5. **Capture full error** in browser DevTools Network tab:
   - Failed request → Response tab
   - Copy entire response JSON
   - Share with debugging info
