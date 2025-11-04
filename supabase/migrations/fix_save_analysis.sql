-- Fix for "Unable to save video analysis" error
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Ensure all tables exist
CREATE TABLE IF NOT EXISTS video_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  duration INTEGER,
  thumbnail_url TEXT,
  transcript JSONB NOT NULL,
  topics JSONB NOT NULL,
  summary TEXT,
  suggested_questions JSONB,
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES video_analyses(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT FALSE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

-- 2. Drop existing function if it has issues
DROP FUNCTION IF EXISTS upsert_video_analysis_with_user_link(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, JSONB, TEXT, UUID);

-- 3. Create the fixed function
CREATE OR REPLACE FUNCTION upsert_video_analysis_with_user_link(
  p_youtube_id TEXT,
  p_title TEXT,
  p_author TEXT,
  p_duration INTEGER,
  p_thumbnail_url TEXT,
  p_transcript JSONB,
  p_topics JSONB,
  p_summary TEXT,
  p_suggested_questions JSONB,
  p_model_used TEXT,
  p_user_id UUID
)
RETURNS TABLE(video_id UUID, is_new BOOLEAN) AS $$
DECLARE
  v_video_id UUID;
  v_is_new BOOLEAN;
BEGIN
  -- Upsert video analysis
  INSERT INTO video_analyses (
    youtube_id, title, author, duration, thumbnail_url,
    transcript, topics, summary, suggested_questions, model_used
  )
  VALUES (
    p_youtube_id, p_title, p_author, p_duration, p_thumbnail_url,
    p_transcript, p_topics, p_summary, p_suggested_questions, p_model_used
  )
  ON CONFLICT (youtube_id) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    duration = EXCLUDED.duration,
    thumbnail_url = EXCLUDED.thumbnail_url,
    transcript = EXCLUDED.transcript,
    topics = EXCLUDED.topics,
    summary = COALESCE(EXCLUDED.summary, video_analyses.summary),
    suggested_questions = COALESCE(EXCLUDED.suggested_questions, video_analyses.suggested_questions),
    model_used = EXCLUDED.model_used,
    updated_at = NOW()
  RETURNING id, (xmax = 0) INTO v_video_id, v_is_new;

  -- Link video to user if user_id is provided
  IF p_user_id IS NOT NULL THEN
    INSERT INTO user_videos (user_id, video_id, accessed_at)
    VALUES (p_user_id, v_video_id, NOW())
    ON CONFLICT (user_id, video_id) DO UPDATE SET
      accessed_at = NOW();
  END IF;

  RETURN QUERY SELECT v_video_id, v_is_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO anon;

-- 5. Enable RLS if not already enabled
ALTER TABLE video_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_videos ENABLE ROW LEVEL SECURITY;

-- 6. Create policies if they don't exist
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Anyone can view video analyses" ON video_analyses;
  DROP POLICY IF EXISTS "Users can view their own video links" ON user_videos;
  DROP POLICY IF EXISTS "Users can create their own video links" ON user_videos;
  DROP POLICY IF EXISTS "Users can update their own video links" ON user_videos;
  DROP POLICY IF EXISTS "Users can delete their own video links" ON user_videos;
END $$;

-- Create fresh policies
CREATE POLICY "Anyone can view video analyses"
  ON video_analyses FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own video links"
  ON user_videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video links"
  ON user_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video links"
  ON user_videos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video links"
  ON user_videos FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_analyses_youtube_id ON video_analyses(youtube_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_user_id ON user_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_video_id ON user_videos(video_id);

-- Done! Test by running a save-analysis request
