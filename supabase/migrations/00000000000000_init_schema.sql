-- Create video_analyses table
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

-- Create user_videos table (tracks which users accessed which videos)
CREATE TABLE IF NOT EXISTS user_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES video_analyses(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT FALSE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

-- Create user_notes table
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES video_analyses(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('chat', 'takeaways', 'transcript', 'custom')),
  source_id TEXT,
  text TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(identifier, action, window_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_video_analyses_youtube_id ON video_analyses(youtube_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_user_id ON user_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_video_id ON user_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_video_id ON user_notes(video_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);

-- Enable Row Level Security
ALTER TABLE video_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_analyses (public read, no write)
CREATE POLICY "Anyone can view video analyses"
  ON video_analyses FOR SELECT
  USING (true);

-- RLS Policies for user_videos
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

-- RLS Policies for user_notes
CREATE POLICY "Users can view their own notes"
  ON user_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
  ON user_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON user_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON user_notes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create the critical RPC function for saving video analysis
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO anon;
