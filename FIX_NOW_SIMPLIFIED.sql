-- ============================================
-- 简化版修复脚本 - 直接执行即可
-- ============================================
-- 在 Supabase Dashboard -> SQL Editor 中运行
-- ============================================

-- 步骤 1: 删除旧函数
DROP FUNCTION IF EXISTS public.upsert_video_analysis_with_user_link(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, JSONB, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS upsert_video_analysis_with_user_link(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, JSONB, TEXT, UUID) CASCADE;

-- 步骤 2: 创建修复后的函数
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
  -- 插入或更新视频分析
  INSERT INTO public.video_analyses (
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
    summary = COALESCE(EXCLUDED.summary, public.video_analyses.summary),
    suggested_questions = COALESCE(EXCLUDED.suggested_questions, public.video_analyses.suggested_questions),
    model_used = EXCLUDED.model_used,
    updated_at = NOW()
  RETURNING id, (xmax = 0) INTO v_video_id, v_is_new;

  -- 关联用户
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.user_videos (user_id, video_id, accessed_at)
    VALUES (p_user_id, v_video_id, NOW())
    ON CONFLICT (user_id, video_id) DO UPDATE SET
      accessed_at = NOW();
  END IF;

  -- ⚠️ 关键修复：显式别名避免歧义
  RETURN QUERY SELECT v_video_id AS video_id, v_is_new AS is_new;
END;
$$;

-- 步骤 3: 授权
GRANT EXECUTE ON FUNCTION public.upsert_video_analysis_with_user_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_video_analysis_with_user_link TO anon;

-- 步骤 4: 验证（查看函数定义中是否包含 "AS video_id"）
SELECT 
  CASE 
    WHEN pg_get_functiondef(p.oid) ILIKE '%AS video_id%' 
    THEN '✅ 修复成功！函数已包含显式别名'
    ELSE '❌ 修复失败，请检查'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'upsert_video_analysis_with_user_link'
  AND n.nspname = 'public';
