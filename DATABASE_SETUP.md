# 数据库设置指南

## 快速修复所有问题

### 1. 在 Supabase 执行 SQL

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧 **SQL Editor**
4. 复制 `supabase/COMPLETE_FIX.sql` 的全部内容
5. 粘贴并点击 **Run**

### 2. 验证修复

执行后，在 **Table Editor** 中应该看到：

#### ✅ 必需的表
- `video_analyses` - 视频分析结果
- `user_videos` - 用户视频关联
- `user_notes` - 用户笔记
- `profiles` - 用户配置（包含 `topic_generation_mode` 列）
- `rate_limits` - 速率限制（包含 `key` 和 `timestamp` 列）

#### ✅ 必需的函数
在 **Database** → **Functions** 中应该看到：
- `upsert_video_analysis_with_user_link`

### 3. 重启开发服务器

```bash
pnpm run dev
```

## 常见错误及解决方法

### 错误 1: `column rate_limits.key does not exist`
**原因**: rate_limits 表结构错误  
**解决**: 执行 `COMPLETE_FIX.sql`

### 错误 2: `column reference "video_id" is ambiguous`
**原因**: SQL 函数有歧义  
**解决**: 执行 `COMPLETE_FIX.sql`

### 错误 3: `Failed to load resource: 400` (profiles 表)
**原因**: profiles 表缺少 `topic_generation_mode` 列  
**解决**: 执行 `COMPLETE_FIX.sql`

### 错误 4: `Failed to load resource: 404` (transcript API)
**原因**: 正常情况，表示视频还没有缓存字幕  
**解决**: 不需要修复，这是预期行为

## 功能说明

### 保存功能
- **已登录**: 视频分析会保存到数据库并关联到你的账户
- **未登录**: 视频分析会保存到数据库，但不关联个人账户

### 速率限制
- **未登录**: 每天 1 个视频
- **已登录**: 每天 5 个视频
- **无限制用户**: 在 `.env.local` 中配置 `UNLIMITED_VIDEO_USERS`

### 本地视频上传
- **有字幕**: 直接使用 SRT/VTT 文件
- **无字幕**: 显示友好提示，建议使用免费工具生成字幕

## 环境变量配置

确保 `.env.local` 包含：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Gemini AI
GEMINI_API_KEY=your-gemini-key

# Optional
SUPADATA_API_KEY=your-supadata-key  # 可选，用于字幕获取
YOUTUBE_API_KEY=your-youtube-key    # 可选，用于额外元数据
CSRF_SALT=random-long-string        # 必需，用于 CSRF 保护
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 可选，默认值
UNLIMITED_VIDEO_USERS=email1@example.com,email2@example.com  # 可选
```

## 验证一切正常

1. ✅ 启动服务器无错误
2. ✅ 可以分析 YouTube 视频
3. ✅ 可以保存分析结果（查看终端日志）
4. ✅ 登录后可以查看历史记录
5. ✅ 本地视频上传功能正常

如果还有问题，查看终端日志中的详细错误信息。
