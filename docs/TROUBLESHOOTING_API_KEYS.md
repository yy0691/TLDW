# Troubleshooting API Key Saving Issues

## Error: 500 Internal Server Error when saving API key

### Symptoms
- When trying to save an API key in the Settings page, you receive a 500 error
- Console shows: "Error saving API key: Error: Failed to save API key"

### Root Cause
This error typically occurs when the database migration for custom provider support hasn't been applied yet, or when there's a CHECK constraint preventing custom provider values.

### Solution

#### Step 1: Run the Database Migrations

You need to run the migrations in your Supabase database. There are two ways to do this:

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Copy the contents of `supabase/migrations/20241220000000_add_custom_provider_support.sql`
5. Paste it into the SQL Editor
6. Click **Run**

**Option B: Via Supabase CLI (if you have it installed)**

```bash
# Make sure you're logged in
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run the migration
supabase db push
```

#### Step 2: Verify the Migration

After running the migration, verify it worked by running this query in the SQL Editor:

```sql
-- Check if the new columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_api_keys' 
AND column_name IN ('base_url', 'model_name', 'provider_name');

-- Check the constraint allows custom providers
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'user_api_keys_provider_check';
```

You should see:
- Three columns: `base_url`, `model_name`, `provider_name`
- A constraint that checks for non-empty provider strings (not limited to 'google' and 'openai')

#### Step 3: Test Saving an API Key

1. Refresh your application page
2. Try saving an API key again
3. If it still fails, check the browser console and server logs for more detailed error messages

### Additional Troubleshooting

#### Check for Encryption Secret

The API key encryption requires an environment variable. Make sure your `.env.local` has:

```bash
API_KEY_ENCRYPTION_SECRET=your-64-character-hex-string
```

If you don't have one, generate it using:

```bash
npm run generate-key
```

This will output a secret that you should add to your `.env.local` file.

#### Verify Database Access

Make sure your Supabase connection is working:

```bash
# Check your environment variables
cat .env.local | grep SUPABASE
```

You should see:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Check Server Logs

Look at your development server output for more detailed error messages. The API route now logs:
- The full error object
- Specific error codes (e.g., constraint violations)
- Helpful messages about what might be wrong

### Common Error Messages

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Database constraint error" | Old CHECK constraint still active | Run the migration |
| "Invalid provider format" | Provider string validation failed | Check that provider is a non-empty string |
| "Custom providers require baseUrl and modelName" | Missing required fields | Fill in all custom provider fields |
| "Unauthorized" | Not logged in | Sign in first |
| "Failed to fetch API keys" | Database connection issue | Check Supabase credentials |

### Still Having Issues?

If you're still experiencing problems:

1. Check the browser console for JavaScript errors
2. Check the server console for detailed error logs
3. Verify your Supabase project is active and accessible
4. Try running the alternative migration: `supabase/migrations/20241221000000_fix_provider_constraint.sql`
5. Make sure Row Level Security (RLS) policies are enabled on the `user_api_keys` table

### Manual Database Fix (Last Resort)

If the migration still doesn't work, you can manually fix the constraint in the SQL Editor:

```sql
-- Drop all CHECK constraints on provider column
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT con.conname
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
        AND rel.relname = 'user_api_keys'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%provider%'
    LOOP
        EXECUTE format('ALTER TABLE user_api_keys DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END LOOP;
END $$;

-- Add the new flexible constraint
ALTER TABLE user_api_keys 
  ADD CONSTRAINT user_api_keys_provider_check 
  CHECK (provider IS NOT NULL AND length(trim(provider)) > 0);
```

This will forcefully remove any provider-related CHECK constraints and add the correct one.
