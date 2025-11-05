# 修复本地视频字幕丢失问题

## 问题描述

本地视频上传成功后，查看分析结果时显示：
```
[Local Video] Failed to load transcript: Error: No transcript found for this local video. 
Please upload the video with subtitles again.
```

## 根本原因

有两个相互关联的问题：

### 问题 1: 字幕过早从 sessionStorage 中删除
在 `app/analyze/[videoId]/page.tsx` 第 674 行，字幕从 sessionStorage 读取后立即被删除：

```typescript
sessionStorage.removeItem(`transcript_${extractedVideoId}`);
```

这导致：
- ✅ 如果分析成功保存到数据库 → 没问题
- ❌ 如果保存失败（如数据库错误）→ 字幕永久丢失
- ❌ 如果用户刷新页面 → 字幕不可用

### 问题 2: 数据库保存失败
由于之前的 `column reference "video_id" is ambiguous` 错误，分析结果无法保存到数据库，导致字幕被删除但数据未保存。

## 解决方案

### 修复 1: 延迟删除字幕（已完成 ✅）

**修改前：**
```typescript
const storedTranscript = sessionStorage.getItem(`transcript_${extractedVideoId}`);
if (storedTranscript) {
  transcriptData = { transcript: JSON.parse(storedTranscript) };
  console.log('[Local Video] Loaded transcript from sessionStorage');
  
  // 立即删除 - 这是问题所在！
  sessionStorage.removeItem(`transcript_${extractedVideoId}`);
}
```

**修改后：**
```typescript
const storedTranscript = sessionStorage.getItem(`transcript_${extractedVideoId}`);
if (storedTranscript) {
  transcriptData = { transcript: JSON.parse(storedTranscript) };
  console.log('[Local Video] Loaded transcript from sessionStorage');
  
  // 不立即删除 - 保留直到成功保存
  // 这允许页面刷新和失败重试
}
```

**在成功保存后删除：**
```typescript
// 在 save-analysis 成功后
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
  const message = buildApiErrorMessage(errorData, "Failed to save analysis");
  throw new Error(message);
}

// 只有在成功保存后才清理
if (isLocalVideo) {
  sessionStorage.removeItem(`transcript_${extractedVideoId}`);
  console.log('[Local Video] Cleaned up transcript from sessionStorage after successful save');
}
```

### 修复 2: 修复数据库保存问题（需要执行）

必须先修复数据库的 `video_id` 歧义问题，否则字幕仍然会丢失。

**在 Supabase Dashboard 中运行：**

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

  IF p_user_id IS NOT NULL THEN
    INSERT INTO user_videos (user_id, video_id, accessed_at)
    VALUES (p_user_id, v_video_id, NOW())
    ON CONFLICT (user_id, video_id) DO UPDATE SET
      accessed_at = NOW();
  END IF;

  -- 关键修复：使用显式别名避免歧义
  RETURN QUERY SELECT v_video_id AS video_id, v_is_new AS is_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_video_analysis_with_user_link TO anon;
```

## 修复流程

### 步骤 1: 应用代码修复（已完成 ✅）

代码已更新：
- ✅ `app/analyze/[videoId]/page.tsx` - 延迟删除字幕
- ✅ 只在成功保存后清理 sessionStorage

### 步骤 2: 修复数据库函数（必须执行）

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 运行上面的 SQL 脚本
4. 验证函数已更新：

```sql
select
  case
    when pg_get_functiondef(p.oid) ilike '%RETURN QUERY SELECT v_video_id AS video_id%'
      then 'OK - Function fixed'
    else 'ERROR - Function not updated'
  end as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'upsert_video_analysis_with_user_link';
```

### 步骤 3: 测试完整流程

1. 上传一个本地视频文件（带字幕）
2. 等待转录完成
3. 检查分析结果是否正常显示
4. 刷新页面，确认字幕仍然可用
5. 检查控制台，确认没有错误
6. 验证数据成功保存到数据库

## 技术细节

### sessionStorage 生命周期

**之前的流程：**
```
上传视频 → 存储字幕到 sessionStorage → 跳转到分析页面 
→ 读取字幕 → 立即删除 → 保存失败 → 字幕永久丢失 ❌
```

**修复后的流程：**
```
上传视频 → 存储字幕到 sessionStorage → 跳转到分析页面 
→ 读取字幕 → 保留在 sessionStorage → 保存成功 → 删除字幕 ✅
→ 如果保存失败 → 字幕仍在 sessionStorage → 可以刷新重试 ✅
```

### 为什么需要两个修复

1. **数据库修复** - 确保保存操作能成功
2. **代码修复** - 确保即使保存失败，字幕也不会丢失

两者缺一不可：
- 只修复数据库 → 字幕仍会在读取后立即删除
- 只修复代码 → 保存仍会失败，字幕会一直占用 sessionStorage

## 已修改的文件

1. ✅ `app/analyze/[videoId]/page.tsx` - 延迟删除字幕逻辑
2. ✅ `supabase/migrations/fix_ambiguous_video_id.sql` - 数据库函数修复

## 额外改进建议

### 1. 添加字幕过期机制

为了避免 sessionStorage 无限增长，可以添加时间戳：

```typescript
// 存储时添加时间戳
const transcriptData = {
  transcript: transcript,
  timestamp: Date.now()
};
sessionStorage.setItem(`transcript_${videoId}`, JSON.stringify(transcriptData));

// 读取时检查过期（24小时）
const stored = JSON.parse(sessionStorage.getItem(`transcript_${videoId}`));
const isExpired = Date.now() - stored.timestamp > 24 * 60 * 60 * 1000;
if (isExpired) {
  sessionStorage.removeItem(`transcript_${videoId}`);
  throw new Error("Transcript expired. Please upload again.");
}
```

### 2. 从数据库恢复字幕

如果字幕已保存到数据库，应该能够从数据库恢复：

```typescript
// 如果 sessionStorage 中没有，尝试从数据库获取
if (!storedTranscript) {
  const { data: savedVideo } = await supabase
    .from('video_analyses')
    .select('transcript')
    .eq('youtube_id', extractedVideoId)
    .single();
  
  if (savedVideo?.transcript) {
    transcriptData = { transcript: savedVideo.transcript };
    console.log('[Local Video] Loaded transcript from database');
  }
}
```

## 测试清单

- [ ] 运行数据库修复 SQL
- [ ] 验证函数已更新
- [ ] 上传本地视频
- [ ] 验证分析结果显示正常
- [ ] 刷新页面，确认字幕仍可用
- [ ] 检查控制台无错误
- [ ] 验证数据保存到数据库
- [ ] 再次刷新，确认字幕已从 sessionStorage 清理

## 故障排查

### 如果字幕仍然丢失

1. **检查 sessionStorage**
   ```javascript
   // 在浏览器控制台运行
   console.log(sessionStorage.getItem('transcript_local_xxx'));
   ```

2. **检查数据库保存日志**
   ```
   查看控制台是否有 "Failed to save analysis" 错误
   ```

3. **验证数据库函数**
   ```sql
   -- 在 Supabase SQL Editor 运行
   select pg_get_functiondef(p.oid)
   from pg_proc p
   where p.proname = 'upsert_video_analysis_with_user_link';
   ```

### 如果保存仍然失败

检查完整的错误信息，可能还有其他数据库问题需要修复。

## 相关文档

- [FIX_LOCAL_VIDEO_SAVE_ERROR.md](./FIX_LOCAL_VIDEO_SAVE_ERROR.md) - 数据库保存错误修复
- [本地视频上传功能.md](./本地视频上传功能.md) - 功能说明文档
