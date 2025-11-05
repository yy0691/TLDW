-- Fix rate_limits table structure
-- Run this in Supabase Dashboard -> SQL Editor

-- Drop the old table if it exists with wrong structure
DROP TABLE IF EXISTS rate_limits CASCADE;

-- Create rate_limits table with correct structure
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_rate_limits_key ON rate_limits(key);
CREATE INDEX idx_rate_limits_timestamp ON rate_limits(timestamp);
CREATE INDEX idx_rate_limits_key_timestamp ON rate_limits(key, timestamp);

-- Enable RLS (but allow all operations for rate limiting to work)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for rate limiting
CREATE POLICY "Allow all operations for rate limiting"
  ON rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to clean up old rate limit entries (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE timestamp < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done! Rate limiting should now work correctly
