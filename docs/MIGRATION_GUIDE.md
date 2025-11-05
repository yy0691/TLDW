# Database Migration Guide

## Overview

This guide explains how to apply database migrations for the TLDW application. Migrations add new tables, columns, constraints, and indexes to your Supabase database.

## Prerequisites

- A Supabase project
- Access to the Supabase Dashboard or Supabase CLI
- Admin access to your database

## Migration Files

All migration files are located in `supabase/migrations/`. They should be run in chronological order based on their timestamps:

1. `00000000000000_init_schema.sql` - Initial database schema
2. `20240101000000_add_collections.sql` - Collections feature
3. `20240101000001_add_videos_storage.sql` - Video storage
4. `20241017120000_add_topic_generation_mode.sql` - Topic generation preferences
5. `20241103000000_add_transcript_translations.sql` - Translation support
6. `20241105000000_add_user_api_keys.sql` - User API keys table (base)
7. `20241220000000_add_custom_provider_support.sql` - Custom AI provider support
8. `20241221000000_fix_provider_constraint.sql` - Fix for provider constraint (if needed)

## Method 1: Supabase Dashboard (Recommended)

This is the easiest method and works for most users.

### Step 1: Access SQL Editor

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Run Migrations

For each migration file (in order):

1. Open the file in a text editor
2. Copy the entire SQL content
3. Paste it into the SQL Editor
4. Click the **Run** button (or press Ctrl/Cmd + Enter)
5. Wait for the "Success" message
6. Repeat for the next migration file

### Step 3: Verify

After running all migrations, verify the changes:

```sql
-- Check if user_api_keys table exists with all columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_api_keys' 
ORDER BY ordinal_position;
```

You should see columns: `id`, `user_id`, `provider`, `api_key_encrypted`, `api_key_preview`, `base_url`, `model_name`, `provider_name`, `is_active`, `created_at`, `updated_at`.

## Method 2: Supabase CLI

If you have the Supabase CLI installed, you can use it to manage migrations.

### Step 1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
curl -fsSL https://supabase.com/install.sh | sh
```

### Step 2: Link Your Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

Your project ref can be found in your Supabase dashboard URL:
`https://supabase.com/dashboard/project/[your-project-ref]`

### Step 3: Push Migrations

```bash
# Push all pending migrations
supabase db push

# Or apply a specific migration
supabase db push --include-name 20241220000000_add_custom_provider_support.sql
```

### Step 4: Verify

```bash
# Check migration status
supabase db status

# View database schema
supabase db inspect
```

## Troubleshooting

### Migration Already Applied

If you see an error like "already exists" or "duplicate column", the migration may have already been applied. You can safely skip it.

### Constraint Errors

If you get errors about CHECK constraints when saving API keys:

1. The `20241220000000_add_custom_provider_support.sql` migration may not have run successfully
2. Try running the fix migration: `20241221000000_fix_provider_constraint.sql`
3. If that doesn't work, see the "Manual Fix" section in `docs/TROUBLESHOOTING_API_KEYS.md`

### Permission Denied

Make sure you have:
- Admin access to your Supabase project
- The correct project selected in the dashboard
- Valid authentication credentials in the CLI

### Migration Fails Partway Through

If a migration fails:

1. Check the error message for specific issues
2. Fix any data inconsistencies mentioned
3. Try running the migration again
4. If it still fails, you may need to manually apply parts of the migration

## Rollback (Advanced)

If you need to undo a migration:

### Manual Rollback

Create a new migration that reverses the changes:

```sql
-- Example: Reverse the custom provider support
ALTER TABLE user_api_keys 
  DROP COLUMN IF EXISTS base_url,
  DROP COLUMN IF EXISTS model_name,
  DROP COLUMN IF EXISTS provider_name;

-- Restore original constraint
ALTER TABLE user_api_keys 
  DROP CONSTRAINT IF EXISTS user_api_keys_provider_check;

ALTER TABLE user_api_keys 
  ADD CONSTRAINT user_api_keys_provider_check 
  CHECK (provider IN ('google', 'openai'));
```

### CLI Rollback

```bash
# Reset to a specific migration
supabase db reset --version 20241105000000
```

⚠️ **Warning:** Rollback operations can cause data loss. Always backup your database first!

## Best Practices

1. **Backup First**: Always backup your database before running migrations
2. **Test Locally**: If using Supabase CLI, test migrations on a local instance first
3. **One at a Time**: Run migrations one at a time and verify each one
4. **Read the SQL**: Always review the SQL before running it
5. **Check Dependencies**: Some migrations depend on previous ones
6. **Monitor Logs**: Watch for errors or warnings in the SQL Editor output

## Getting Help

If you encounter issues:

1. Check `docs/TROUBLESHOOTING_API_KEYS.md` for API key-specific issues
2. Review the migration file comments for context
3. Check Supabase logs in the Dashboard → Logs section
4. Join the Supabase Discord or GitHub Discussions

## Additional Resources

- [Supabase Migrations Documentation](https://supabase.com/docs/guides/cli/managing-environments#migrations)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [DATABASE_SETUP.md](../DATABASE_SETUP.md) - Database setup guide
- [TROUBLESHOOTING_API_KEYS.md](./TROUBLESHOOTING_API_KEYS.md) - API key issues
