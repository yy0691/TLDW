# Changelog: API Key Save Fix

## [2024-01-21] - Fixed 500 Error When Saving API Keys

### Fixed
- **Database Migration Issue**: Fixed the CHECK constraint on the `user_api_keys.provider` column that was preventing custom providers from being saved
- **Migration Script**: Updated `20241220000000_add_custom_provider_support.sql` to properly handle auto-generated constraint names
- **Error Handling**: Improved error messages in the API route to provide more helpful guidance when issues occur
- **Client Feedback**: Enhanced error display in the UI to show both user-friendly messages and technical details

### Added
- **New Migration**: Created `20241221000000_fix_provider_constraint.sql` as an alternative fix for existing installations
- **Documentation**: Added comprehensive troubleshooting guide in `docs/TROUBLESHOOTING_API_KEYS.md`
- **Documentation**: Added migration guide in `docs/MIGRATION_GUIDE.md`
- **Documentation**: Added fix summary in `docs/API_KEY_SAVE_FIX.md`
- **Warnings**: Added console warnings when `API_KEY_ENCRYPTION_SECRET` is not set

### Changed
- **Migration Logic**: Changed from simple `DROP CONSTRAINT IF EXISTS` to dynamic constraint discovery and removal
- **Error Messages**: API route now returns detailed error information including constraint violation details
- **README**: Updated to reference the new troubleshooting documentation

## Problem Description

Users were encountering a 500 Internal Server Error when attempting to save API keys, particularly for custom providers like DeepSeek, Zhipu AI, Qwen, Moonshot, and Doubao.

### Root Cause

The initial migration (`20241105000000_add_user_api_keys.sql`) created a CHECK constraint inline:
```sql
provider TEXT NOT NULL CHECK (provider IN ('google', 'openai'))
```

PostgreSQL auto-generated a constraint name for this inline constraint. When the custom provider support migration (`20241220000000_add_custom_provider_support.sql`) tried to drop the constraint, it used a specific name that didn't match the auto-generated one:
```sql
DROP CONSTRAINT IF EXISTS user_api_keys_provider_check
```

As a result, the old restrictive constraint remained in place, causing validation errors when trying to save custom providers.

## Solution Details

### 1. Migration Script Enhancement

The updated migration now:

1. **Checks for expected constraint name first**:
   ```sql
   IF EXISTS (
       SELECT 1 FROM pg_constraint 
       WHERE conname = 'user_api_keys_provider_check'
       AND conrelid = 'user_api_keys'::regclass
   ) THEN
       ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_provider_check;
   END IF;
   ```

2. **Dynamically finds and drops auto-generated constraints**:
   ```sql
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
   ```

3. **Adds the new flexible constraint**:
   ```sql
   ALTER TABLE user_api_keys 
     ADD CONSTRAINT user_api_keys_provider_check 
     CHECK (provider IS NOT NULL AND length(trim(provider)) > 0);
   ```

### 2. API Route Improvements

```typescript
if (error) {
  console.error('Error saving API key:', error);
  console.error('Error details:', JSON.stringify(error, null, 2));
  
  let errorMessage = 'Failed to save API key';
  if (error.message?.includes('constraint') || error.message?.includes('check')) {
    errorMessage = 'Database constraint error. Please ensure the migrations have been run. Check the console for details.';
  } else if (error.code === '23505') {
    errorMessage = 'An API key for this provider already exists';
  }
  
  return NextResponse.json(
    { 
      error: errorMessage,
      details: error.message 
    },
    { status: 500 }
  );
}
```

### 3. Client-Side Error Display

```typescript
if (!response.ok) {
  const error = await response.json()
  const errorMessage = error.details 
    ? `${error.error}\n\nDetails: ${error.details}`
    : error.error || 'Failed to save API key'
  throw new Error(errorMessage)
}
```

## Migration Instructions

### For Existing Installations

If you're experiencing this issue, run one of these migrations in your Supabase SQL Editor:

**Option 1** (Recommended): Run the updated main migration:
```bash
supabase/migrations/20241220000000_add_custom_provider_support.sql
```

**Option 2**: Run the dedicated fix migration:
```bash
supabase/migrations/20241221000000_fix_provider_constraint.sql
```

### For New Installations

No action needed - the fix is included in the updated migration script.

## Verification

After applying the fix, verify with:

```sql
-- Check constraint definition
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'user_api_keys_provider_check';

-- Should return:
-- constraint_name: user_api_keys_provider_check
-- check_clause: ((provider IS NOT NULL) AND (length(trim(provider)) > 0))
```

## Testing

Tested scenarios:
- ✅ Fresh database installation
- ✅ Database with existing old constraint
- ✅ Saving Google Gemini API key
- ✅ Saving OpenAI API key
- ✅ Saving custom provider keys (DeepSeek, Zhipu, Qwen, Moonshot, Doubao)
- ✅ Error message display for constraint violations
- ✅ Error message display for missing encryption secret

## Related Files

- `supabase/migrations/20241105000000_add_user_api_keys.sql` - Original migration
- `supabase/migrations/20241220000000_add_custom_provider_support.sql` - Updated migration
- `supabase/migrations/20241221000000_fix_provider_constraint.sql` - Alternative fix
- `app/api/user/api-keys/route.ts` - API route with improved error handling
- `components/api-keys-manager.tsx` - UI component with better error display
- `lib/api-key-encryption.ts` - Encryption module with warnings
- `docs/TROUBLESHOOTING_API_KEYS.md` - Troubleshooting guide
- `docs/MIGRATION_GUIDE.md` - Migration instructions
- `docs/API_KEY_SAVE_FIX.md` - Detailed fix documentation

## Future Improvements

To prevent similar issues:
1. Always use named constraints instead of inline CHECK constraints
2. Test migrations on both fresh and existing databases
3. Use dynamic SQL for constraint operations
4. Include migration verification steps in CI/CD
5. Add database schema tests

## Support

If you encounter any issues:
1. Check `docs/TROUBLESHOOTING_API_KEYS.md`
2. Review server console logs for detailed errors
3. Verify all migrations have been run
4. Ensure `API_KEY_ENCRYPTION_SECRET` is set
