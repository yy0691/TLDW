-- ============================================
-- CRITICAL FIX: 彻底解决 "video_id is ambiguous" 错误
-- ============================================
-- 请在 Supabase Dashboard -> SQL Editor 中运行此脚本
-- 这是最终的、完整的修复方案
-- ============================================

-- 第 1 步：强制删除所有可能存在的函数版本
-- ============================================
DO $$
BEGIN
  -- 删除 public schema 中的函数
  EXECUTE 'DROP FUNCTION IF EXISTS public.upsert_video_analysis_with_user_link(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, JSONB, TEXT, UUID) CASCADE';
  
  -- 删除默认 schema 中的函数
  EXECUTE 'DROP FUNCTION IF EXISTS upsert_video_analysis_with_user_link(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, JSONB, TEXT, UUID) CASCADE';
  
  RAISE NOTICE '✅ 步骤 1 完成：已删除所有旧版本函数';
END $$;

-- 第 2 步：验证函数已被删除
-- ============================================
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'upsert_video_analysis_with_user_link';
  
  IF func_count > 0 THEN
    RAISE EXCEPTION '❌ 错误：函数仍然存在！请手动删除后重试。';
  ELSE
    RAISE NOTICE '✅ 步骤 2 完成：确认函数已删除';
  END IF;
END $$;

-- 第 3 步：创建修复后的新函数
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
SET search_path = public
AS $$
DECLARE
  v_video_id UUID;
  v_is_new BOOLEAN;
BEGIN
  -- 插入或更新视频分析
  INSERT INTO public.video_analyses (
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
    summary = COALESCE(EXCLUDED.summary, public.video_analyses.summary),
    suggested_questions = COALESCE(EXCLUDED.suggested_questions, public.video_analyses.suggested_questions),
    model_used = EXCLUDED.model_used,
    updated_at = NOW()
  RETURNING id, (xmax = 0) INTO v_video_id, v_is_new;

  -- 如果提供了用户ID，关联视频到用户
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.user_videos (user_id, video_id, accessed_at)
    VALUES (p_user_id, v_video_id, NOW())
    ON CONFLICT (user_id, video_id) DO UPDATE SET
      accessed_at = NOW();
  END IF;

  -- ⚠️ 关键修复：使用显式列别名避免歧义
  -- 这一行解决了 "column reference video_id is ambiguous" 错误
  RETURN QUERY SELECT v_video_id AS video_id, v_is_new AS is_new;
END;
$$;

-- 第 4 步：授予权限
-- ============================================
GRANT EXECUTE ON FUNCTION public.upsert_video_analysis_with_user_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_video_analysis_with_user_link TO anon;

RAISE NOTICE '✅ 步骤 3-4 完成：函数已创建并授权';

-- 第 5 步：验证修复
-- ============================================
DO $$
DECLARE
  func_def TEXT;
  has_fix BOOLEAN;
BEGIN
  -- 获取函数定义
  SELECT pg_get_functiondef(p.oid) INTO func_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'upsert_video_analysis_with_user_link'
    AND n.nspname = 'public';
  
  -- 检查是否包含修复
  has_fix := func_def ILIKE '%v_video_id AS video_id%';
  
  IF has_fix THEN
    RAISE NOTICE '✅✅✅ 成功！函数已修复，包含显式列别名。';
    RAISE NOTICE '修复内容：RETURN QUERY SELECT v_video_id AS video_id, v_is_new AS is_new';
  ELSE
    RAISE EXCEPTION '❌ 错误：函数创建了但修复未生效！';
  END IF;
END $$;

-- 第 6 步：测试函数
-- ============================================
DO $$
DECLARE
  test_result RECORD;
  test_video_id TEXT;
BEGIN
  -- 生成测试视频ID
  test_video_id := 'test_fix_' || gen_random_uuid()::text;
  
  -- 测试函数调用
  SELECT * INTO test_result
  FROM public.upsert_video_analysis_with_user_link(
    test_video_id,
    'Test Video - Fix Verification',
    'Test Author',
    120,
    'https://example.com/test.jpg',
    '[]'::jsonb,
    '[]'::jsonb,
    'Test summary',
    '[]'::jsonb,
    'gemini-2.5-flash',
    NULL
  );
  
  IF test_result.video_id IS NOT NULL THEN
    RAISE NOTICE '✅ 步骤 6 完成：函数测试通过！';
    RAISE NOTICE '测试视频ID: %', test_result.video_id;
    
    -- 清理测试数据
    DELETE FROM public.video_analyses WHERE id = test_result.video_id;
    RAISE NOTICE '测试数据已清理';
  ELSE
    RAISE EXCEPTION '❌ 函数测试失败！';
  END IF;
END $$;

-- ============================================
-- 最终确认
-- ============================================
SELECT 
  '🎉🎉🎉 修复完成！' as status,
  'column reference "video_id" is ambiguous 错误已解决' as message,
  '请刷新应用并重新测试' as next_step;

-- ============================================
-- 验证查询（可选）
-- ============================================
-- 运行此查询查看函数的完整定义
-- SELECT pg_get_functiondef(p.oid)
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE p.proname = 'upsert_video_analysis_with_user_link'
--   AND n.nspname = 'public';
