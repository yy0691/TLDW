-- Fix the provider check constraint to allow custom providers
-- This migration ensures the old constraint is properly removed and a new one is added

-- First, get all constraint names that match the pattern and drop them
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Find and drop all CHECK constraints on the provider column
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
