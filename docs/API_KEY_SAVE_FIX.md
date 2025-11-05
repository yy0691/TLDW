# Fix: 500 Error When Saving API Keys

## Problem Summary

Users were encountering a 500 Internal Server Error when trying to save API keys (especially custom providers like DeepSeek, Zhipu, etc.) in the Settings page.

## Root Cause

The issue was caused by a database CHECK constraint that was limiting the `provider` column to only accept `'google'` or `'openai'` values. When the custom provider support was added, a migration was created to remove this constraint and add a more flexible one, but the migration script wasn't handling all edge cases properly.

Specifically:
1. The original migration created a CHECK constraint inline with the column definition
2. PostgreSQL auto-generated a constraint name
3. The update migration tried to drop the constraint using an expected name that might not match the auto-generated one
4. As a result, the old restrictive constraint remained in place
5. When users tried to save custom providers, the constraint violation caused a 500 error

## Solution

### 1. Updated Migration Script

**File:** `supabase/migrations/20241220000000_add_custom_provider_support.sql`

The migration now:
- Uses a `DO` block to dynamically find and drop the old constraint
- Checks for both the expected constraint name and any auto-generated names
- Uses pattern matching to find constraints related to the provider column
- Safely handles cases where the constraint might have different names

### 2. Improved Error Handling

**File:** `app/api/user/api-keys/route.ts`

Changes made:
- Added detailed error logging with full error object output
- Improved error messages that guide users to the troubleshooting docs
- Added specific handling for constraint errors
- Returns both a user-friendly message and technical details

### 3. Better Client-Side Feedback

**File:** `components/api-keys-manager.tsx`

Changes made:
- Display detailed error messages including technical details
- Better formatting of error messages in toast notifications

### 4. Enhanced Encryption Warnings

**File:** `lib/api-key-encryption.ts`

Changes made:
- Added console warnings when `API_KEY_ENCRYPTION_SECRET` is not set
- Clearer indication that the fallback is using a temporary key
- Guidance on how to generate a proper encryption secret

## Files Changed

```
supabase/migrations/
  └── 20241220000000_add_custom_provider_support.sql    [UPDATED]
  └── 20241221000000_fix_provider_constraint.sql        [NEW]

app/api/user/api-keys/
  └── route.ts                                          [UPDATED]

components/
  └── api-keys-manager.tsx                              [UPDATED]

lib/
  └── api-key-encryption.ts                             [UPDATED]

docs/
  ├── TROUBLESHOOTING_API_KEYS.md                       [NEW]
  ├── MIGRATION_GUIDE.md                                [NEW]
  └── API_KEY_SAVE_FIX.md                               [THIS FILE]

README.md                                               [UPDATED]
```

## Migration Script Changes

### Before:
```sql
ALTER TABLE user_api_keys 
  DROP CONSTRAINT IF EXISTS user_api_keys_provider_check;
```

This only worked if the constraint had the exact name `user_api_keys_provider_check`, which might not be the case if it was auto-generated.

### After:
```sql
DO $$ 
BEGIN
    -- Try to drop the constraint if it exists with the expected name
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_api_keys_provider_check'
        AND conrelid = 'user_api_keys'::regclass
    ) THEN
        ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_provider_check;
    END IF;
    
    -- Also try to drop any auto-generated constraint on the provider column
    PERFORM 1 FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'user_api_keys'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%provider%IN%(%google%,%openai%)%';
    
    IF FOUND THEN
        EXECUTE (
            SELECT 'ALTER TABLE user_api_keys DROP CONSTRAINT ' || quote_ident(con.conname)
            FROM pg_constraint con
            INNER JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'user_api_keys'
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) LIKE '%provider%IN%(%google%,%openai%)%'
            LIMIT 1
        );
    END IF;
END $$;
```

This dynamically finds and drops the constraint regardless of its name.

## How to Apply the Fix

### For Users Experiencing This Issue

1. **Run the updated migration:**
   - Go to Supabase Dashboard → SQL Editor
   - Run the contents of `supabase/migrations/20241220000000_add_custom_provider_support.sql`
   - Or alternatively, run `supabase/migrations/20241221000000_fix_provider_constraint.sql`

2. **Verify the fix:**
   ```sql
   SELECT constraint_name, check_clause
   FROM information_schema.check_constraints
   WHERE constraint_name = 'user_api_keys_provider_check';
   ```
   
   The check clause should show: `(provider IS NOT NULL AND length(trim(provider)) > 0)`

3. **Test saving an API key:**
   - Refresh your application
   - Try saving a custom provider API key
   - It should now work without errors

### For New Installations

No action needed - the updated migration script will work correctly from the start.

## Verification Steps

After applying the fix, verify that:

1. ✅ The `user_api_keys` table has the columns: `base_url`, `model_name`, `provider_name`
2. ✅ The provider constraint allows any non-empty string
3. ✅ You can save API keys for Google Gemini
4. ✅ You can save API keys for OpenAI
5. ✅ You can save API keys for custom providers (DeepSeek, Zhipu, etc.)
6. ✅ Error messages are helpful if something goes wrong

## Additional Documentation

- **For troubleshooting:** See `docs/TROUBLESHOOTING_API_KEYS.md`
- **For migration help:** See `docs/MIGRATION_GUIDE.md`
- **For general setup:** See `README.md` and `DATABASE_SETUP.md`

## Prevention

To prevent similar issues in the future:

1. Always use named constraints instead of inline definitions
2. Test migrations against a fresh database
3. Test migrations against databases with existing data
4. Use `IF EXISTS` and dynamic SQL for constraint operations
5. Add comprehensive error logging to API routes
6. Include migration verification steps in documentation

## Testing Checklist

- [x] Migration works on a fresh database
- [x] Migration works on a database with the old constraint
- [x] API route returns helpful error messages
- [x] Client displays detailed errors
- [x] Can save Google Gemini keys
- [x] Can save OpenAI keys
- [x] Can save custom provider keys (DeepSeek, Zhipu, etc.)
- [x] Encryption warnings appear when secret is missing
- [x] Documentation is comprehensive and helpful

## Related Issues

This fix resolves:
- 500 errors when saving API keys
- "Failed to save API key" errors
- Constraint violation errors for custom providers
- Unclear error messages

## Questions?

If you encounter any issues:
1. Check the server console logs for detailed error information
2. Verify all migrations have been run in order
3. Ensure `API_KEY_ENCRYPTION_SECRET` is set in `.env.local`
4. See the troubleshooting guide in `docs/TROUBLESHOOTING_API_KEYS.md`
