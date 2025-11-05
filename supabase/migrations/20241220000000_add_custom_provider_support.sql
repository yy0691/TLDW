-- Add support for custom AI providers with custom URLs and models
-- Add new columns for custom provider configuration
ALTER TABLE user_api_keys 
  ADD COLUMN IF NOT EXISTS base_url TEXT,
  ADD COLUMN IF NOT EXISTS model_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_name TEXT;

-- Drop the old CHECK constraint - handle both possible names
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
    -- This handles cases where the constraint was created inline
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

-- Add a more flexible constraint that allows any non-empty provider string
ALTER TABLE user_api_keys 
  ADD CONSTRAINT user_api_keys_provider_check 
  CHECK (provider IS NOT NULL AND length(trim(provider)) > 0);

-- Create an index on provider_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider_name ON user_api_keys(provider_name);

-- Add comments to document the new columns
COMMENT ON COLUMN user_api_keys.base_url IS 'Custom API base URL for OpenAI-compatible endpoints (e.g., https://api.deepseek.com/v1)';
COMMENT ON COLUMN user_api_keys.model_name IS 'Custom model name to use with the provider (e.g., deepseek-chat, gpt-4)';
COMMENT ON COLUMN user_api_keys.provider_name IS 'Display name for custom providers (e.g., DeepSeek, Zhipu AI, Qwen)';
