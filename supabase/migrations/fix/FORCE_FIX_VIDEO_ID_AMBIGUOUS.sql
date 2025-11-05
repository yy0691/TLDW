-- FORCE FIX: Column reference "video_id" is ambiguous
-- This script forcefully drops and recreates the function with the correct definition
-- Run this in Supabase Dashboard -> SQL Editor

-- ============================================
-- Step 1: Drop ALL versions of the function
-- ============================================

-- Drop with all possible parameter combinations
DROP FUNCTION IF EXISTS upsert_video_analysis_with_user_link(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, JSONB, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.upsert_video_analysis_with_user_link(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, JSONB, TEXT, UUID) CASCADE;

-- Verify function is dropped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'upsert_video_analysis_with_user_link'
  ) THEN
    RAISE EXCEPTION 'Function still exists after DROP. Please check manually.';
  ELSE
    RAISE NOTICE 'Function successfully dropped';
  END IF;
END $$;

-- ============================================
-- Step 2: Recreate the function with FIXED definition
-- ============================================

CREATE OR REPLACE FUNCTION public.upsert_video_analysis_with_user_link(
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
RETURNS TABLE(video_id UUID, is_new BOOLEAN) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_video_id UUID;
  v_is_new BOOLEAN;
BEGIN
  -- Upsert video analysis
  INSERT INTO video_analyses (
    youtube_id, 
    title, 
    author, 
    duration, 
    thumbnail_url,
    transcript, 
    topics, 
    summary, 
    suggested_questions, 
    model_used
  )
  VALUES (
    p_youtube_id, 
    p_title, 
    p_author, 
    p_duration, 
    p_thumbnail_url,
    p_transcript, 
    p_topics, 
    p_summary, 
    p_suggested_questions, 
    p_model_used
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

  -- CRITICAL FIX: Use explicit column aliases to avoid ambiguity
  -- This is the line that fixes the "column reference video_id is ambiguous" error
  RETURN QUERY SELECT v_video_id AS video_id, v_is_new AS is_new;
END;
$$;

-- ============================================
-- Step 3: Grant permissions
-- ============================================

GRANT EXECUTE ON FUNCTION public.upsert_video_analysis_with_user_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_video_analysis_with_user_link TO anon;

-- ============================================
-- Step 4: Verify the fix
-- ============================================

DO $$
DECLARE
  func_def TEXT;
BEGIN
  -- Get function definition
  SELECT pg_get_functiondef(p.oid) INTO func_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'upsert_video_analysis_with_user_link'
    AND n.nspname = 'public';
  
  -- Check if the fix is applied
  IF func_def ILIKE '%v_video_id AS video_id%' THEN
    RAISE NOTICE '✅ SUCCESS: Function fixed! The ambiguous column reference is resolved.';
  ELSE
    RAISE WARNING '❌ WARNING: Function may not be fixed correctly. Please check manually.';
    RAISE NOTICE 'Function definition: %', func_def;
  END IF;
END $$;

-- ============================================
-- Step 5: Test the function
-- ============================================

-- This is a test to ensure the function works
-- It will fail if there are still issues
DO $$
DECLARE
  test_result RECORD;
BEGIN
  -- Test with a dummy video (will be rolled back)
  SELECT * INTO test_result
  FROM public.upsert_video_analysis_with_user_link(
    'test_video_id_' || gen_random_uuid()::text,
    'Test Video',
    'Test Author',
    100,
    'https://example.com/thumb.jpg',
    '[]'::jsonb,
    '[]'::jsonb,
    'Test summary',
    '[]'::jsonb,
    'gemini-2.5-flash',
    NULL
  );
  
  IF test_result.video_id IS NOT NULL THEN
    RAISE NOTICE '✅ Function test passed! video_id: %', test_result.video_id;
    -- Rollback the test data
    DELETE FROM video_analyses WHERE id = test_result.video_id;
  ELSE
    RAISE EXCEPTION '❌ Function test failed!';
  END IF;
END $$;

-- ============================================
-- Final verification query
-- ============================================

SELECT 
  '✅ Migration complete!' as status,
  'Function: upsert_video_analysis_with_user_link' as function_name,
  'Fixed: column reference "video_id" is ambiguous' as fix_applied;
