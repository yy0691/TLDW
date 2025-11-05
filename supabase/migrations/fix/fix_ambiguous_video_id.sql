-- Fix for "column reference video_id is ambiguous" error
-- This migration ensures the upsert_video_analysis_with_user_link function is correctly defined
-- Run this in Supabase Dashboard -> SQL Editor

-- Step 1: Drop the existing function to ensure clean state
DROP FUNCTION IF EXISTS upsert_video_analysis_with_user_link(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, JSONB, TEXT, UUID);

-- Step 2: Recreate the function with explicit column references
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

  -- Return results with explicit variable names (no ambiguity)
  RETURN QUERY SELECT v_video_id AS video_id, v_is_new AS is_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant necessary permissions
GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO anon;

-- Step 4: Verify the function was created successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'upsert_video_analysis_with_user_link'
  ) THEN
    RAISE NOTICE 'Function upsert_video_analysis_with_user_link created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create function upsert_video_analysis_with_user_link';
  END IF;
END $$;
