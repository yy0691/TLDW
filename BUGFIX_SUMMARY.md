# Bug Fix Summary: API Key Save 500 Error

## Issue
Users reported a 500 Internal Server Error when trying to save API keys (especially custom providers) in the Settings page.

## Root Cause
The database CHECK constraint on the `user_api_keys.provider` column was limiting values to only `'google'` or `'openai'`. The constraint was created inline in the initial migration, causing PostgreSQL to auto-generate a constraint name. The subsequent migration to add custom provider support failed to properly drop this constraint because it didn't match the auto-generated name.

## Changes Made

### 1. Database Migration Files

#### Updated: `supabase/migrations/20241220000000_add_custom_provider_support.sql`
- Added dynamic constraint discovery using PostgreSQL system catalogs
- Handles both expected and auto-generated constraint names
- Uses pattern matching to find and drop old constraints
- More robust and reliable migration process

#### Created: `supabase/migrations/20241221000000_fix_provider_constraint.sql`
- Alternative fix migration for existing installations
- Drops all provider-related CHECK constraints
- Adds the new flexible constraint

### 2. API Route Improvements

#### Updated: `app/api/user/api-keys/route.ts`
- Added detailed error logging with full error object
- Improved error messages that guide users to documentation
- Specific handling for constraint violations
- Returns both user-friendly messages and technical details

### 3. Client-Side Enhancements

#### Updated: `components/api-keys-manager.tsx`
- Displays detailed error messages including technical information
- Better error formatting in toast notifications

#### Updated: `lib/api-key-encryption.ts`
- Added console warnings when `API_KEY_ENCRYPTION_SECRET` is missing
- Clearer indication of temporary key usage in development

### 4. Documentation

#### Created: `docs/TROUBLESHOOTING_API_KEYS.md`
- Comprehensive troubleshooting guide for API key issues
- Step-by-step solutions for common problems
- Migration instructions
- Manual fix procedures

#### Created: `docs/MIGRATION_GUIDE.md`
- Complete guide for running database migrations
- Instructions for both Supabase Dashboard and CLI
- Troubleshooting migration issues
- Best practices and verification steps

#### Created: `docs/API_KEY_SAVE_FIX.md`
- Detailed technical documentation of the fix
- Before/after comparisons
- Verification steps
- Testing checklist

#### Created: `CHANGELOG_API_KEY_FIX.md`
- Detailed changelog of all changes
- Problem description and solution
- Migration instructions
- Testing details

#### Updated: `README.md`
- Added reference to troubleshooting documentation
- Mentioned `user_api_keys` table in setup instructions

## How Users Should Apply the Fix

### Option 1: Run Updated Migration (Recommended)
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/20241220000000_add_custom_provider_support.sql`
3. Click Run
4. Refresh the application and test

### Option 2: Run Fix Migration
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/20241221000000_fix_provider_constraint.sql`
3. Click Run
4. Refresh the application and test

### Verification
Run this query to verify the fix:
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'user_api_keys_provider_check';
```

Expected result:
- Constraint should check: `(provider IS NOT NULL AND length(trim(provider)) > 0)`

## Files Modified

```
Modified:
- supabase/migrations/20241220000000_add_custom_provider_support.sql
- app/api/user/api-keys/route.ts
- components/api-keys-manager.tsx
- lib/api-key-encryption.ts
- README.md

Created:
- supabase/migrations/20241221000000_fix_provider_constraint.sql
- docs/TROUBLESHOOTING_API_KEYS.md
- docs/MIGRATION_GUIDE.md
- docs/API_KEY_SAVE_FIX.md
- CHANGELOG_API_KEY_FIX.md
- BUGFIX_SUMMARY.md (this file)
```

## Testing Checklist

- ✅ Migration works on fresh database
- ✅ Migration works on database with old constraint
- ✅ Can save Google Gemini API keys
- ✅ Can save OpenAI API keys
- ✅ Can save custom provider keys (DeepSeek, Zhipu, Qwen, etc.)
- ✅ Error messages are helpful and actionable
- ✅ Encryption warnings appear when secret is missing
- ✅ Documentation is comprehensive
- ✅ No linting errors

## Prevention Measures

To prevent similar issues in the future:
1. ✅ Use named constraints instead of inline definitions
2. ✅ Add comprehensive error logging
3. ✅ Test migrations on both fresh and existing databases
4. ✅ Use dynamic SQL for constraint operations
5. ✅ Document troubleshooting steps

## Additional Notes

- The fix is backward compatible
- No data migration is required
- Existing API keys will continue to work
- The encryption mechanism is unchanged
- All security measures remain in place

## Support

For issues or questions:
1. See `docs/TROUBLESHOOTING_API_KEYS.md` for detailed troubleshooting
2. Check server console logs for error details
3. Verify all migrations have been run in order
4. Ensure `API_KEY_ENCRYPTION_SECRET` is set in environment variables

## Commit Message Suggestion

```
fix: resolve 500 error when saving custom provider API keys

- Update migration to handle auto-generated constraint names
- Add dynamic constraint discovery and removal
- Improve API error messages and logging
- Add comprehensive troubleshooting documentation
- Add warnings for missing encryption secret

Fixes #[issue-number]
```
