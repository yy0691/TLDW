-- Fix: Add INSERT policy for video_analyses table
-- This allows both authenticated users and anonymous users to create video analysis records

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Anyone can insert video analyses" ON video_analyses;

-- Create INSERT policy
CREATE POLICY "Anyone can insert video analyses"
  ON video_analyses FOR INSERT
  WITH CHECK (true);

-- Also add UPDATE policy for when transcript/topics are updated
DROP POLICY IF EXISTS "Anyone can update video analyses" ON video_analyses;

CREATE POLICY "Anyone can update video analyses"
  ON video_analyses FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'video_analyses'
ORDER BY policyname;
