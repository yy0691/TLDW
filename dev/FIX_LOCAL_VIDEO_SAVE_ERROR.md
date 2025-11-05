# 修复本地视频上传后无法保存分析结果的问题

## 问题描述

本地视频成功上传后，跳转到分析页面时出现以下错误：
- ❌ 无法保存分析结果
- ❌ 控制台报错：`column reference "video_id" is ambiguous`
- ❌ API 返回 500 错误

## 根本原因

数据库函数 `upsert_video_analysis_with_user_link` 中的 `RETURN QUERY SELECT v_video_id, v_is_new;` 语句存在列名歧义。

PostgreSQL 无法确定 `video_id` 是指：
1. 函数返回表中的 `video_id` 列
2. `user_videos` 表中的 `video_id` 列

## 解决方案

### 步骤 1: 在 Supabase Dashboard 中运行 SQL 修复脚本

1. 打开 Supabase Dashboard
2. 进入 **SQL Editor**
3. 运行以下 SQL 脚本（选择其中一个）：

#### 选项 A: 使用新创建的修复脚本（推荐）

```bash
# 复制文件内容
cat supabase/migrations/fix_ambiguous_video_id.sql
```

然后在 Supabase SQL Editor 中粘贴并执行。

#### 选项 B: 直接运行以下 SQL

```sql
-- 删除旧函数
DROP FUNCTION IF EXISTS upsert_video_analysis_with_user_link(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, JSONB, TEXT, UUID);

-- 重新创建函数（修复歧义）
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

  -- 修复：使用显式别名避免歧义
  RETURN QUERY SELECT v_video_id AS video_id, v_is_new AS is_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予权限
GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO anon;
```

### 步骤 2: 验证修复

1. 重启开发服务器（如果正在运行）：
```bash
npm run dev
```

2. 测试本地视频上传：
   - 上传一个本地视频文件
   - 等待转录完成
   - 检查是否能成功保存分析结果
   - 验证是否能查看分析内容

### 步骤 3: 检查控制台

确认以下错误已消失：
- ✅ 不再出现 `column reference "video_id" is ambiguous` 错误
- ✅ `/api/save-analysis` 返回 200 状态码
- ✅ 分析结果成功保存到数据库

## 技术细节

### 修改内容

**修改前：**
```sql
RETURN QUERY SELECT v_video_id, v_is_new;
```

**修改后：**
```sql
RETURN QUERY SELECT v_video_id AS video_id, v_is_new AS is_new;
```

### 为什么需要显式别名？

在 PostgreSQL 中，当函数返回表类型时，如果 `RETURN QUERY` 中的列名与：
- 函数返回表的列名相同
- 或者与查询中涉及的表的列名相同

就会产生歧义。使用 `AS` 显式指定别名可以消除这种歧义。

## 已修改的文件

1. ✅ `supabase/migrations/fix_ambiguous_video_id.sql` - 新建修复脚本
2. ✅ `supabase/migrations/00000000000000_init_schema.sql` - 更新初始化脚本
3. ✅ `supabase/migrations/fix_save_analysis.sql` - 更新修复脚本
4. ✅ `supabase/migrations/complete_fix_local_video.sql` - 更新完整修复脚本

## 其他相关错误

控制台中还有一个 406 错误：
```
GET .../profiles?select=topic_generation_mode&id=eq.xxx 406 (Not Acceptable)
```

这个错误不影响视频保存功能，但建议检查：
1. `profiles` 表是否存在 `topic_generation_mode` 列
2. RLS 策略是否正确配置
3. API 请求头是否包含正确的 `Accept` 和 `Content-Type`

## 测试清单

- [ ] 运行 SQL 修复脚本
- [ ] 重启开发服务器
- [ ] 上传本地视频
- [ ] 验证转录成功
- [ ] 验证分析结果保存成功
- [ ] 验证可以查看分析内容
- [ ] 检查控制台无错误

## 需要帮助？

如果问题仍然存在，请检查：
1. Supabase 函数是否成功更新（在 Database > Functions 中查看）
2. 数据库日志（在 Supabase Dashboard > Logs 中查看）
3. 浏览器控制台的完整错误信息
