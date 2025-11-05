# 修复控制台报错

## 报错概览

### 1. Vercel Analytics CSP 错误 ✅ 已修复

```
Refused to load the script 'https://va.vercel-scripts.com/v1/script.debug.js' 
because it violates the following Content Security Policy directive
```

**影响：** 仅影响 Vercel Analytics 统计，不影响应用核心功能

**修复：** 已在 `middleware.ts` 中添加 Vercel Analytics 域名到 CSP 白名单

### 2. Profiles 表 406 错误 ⚠️ 需要修复

```
GET .../profiles?select=topic_generation_mode&id=eq.xxx 406 (Not Acceptable)
```

**影响：** 无法获取用户的主题生成模式偏好设置

**原因：** `profiles` 表可能不存在或缺少 `topic_generation_mode` 列

---

## 详细修复步骤

### 修复 1: Vercel Analytics CSP（已完成 ✅）

#### 修改内容

在 `middleware.ts` 中更新 CSP 策略：

**修改前：**
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://*.googleapis.com",
"connect-src 'self' https://api.supadata.ai https://*.supabase.co https://*.googleapis.com wss://*.supabase.co https://www.youtube.com",
```

**修改后：**
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://*.googleapis.com https://va.vercel-scripts.com",
"connect-src 'self' https://api.supadata.ai https://*.supabase.co https://*.googleapis.com wss://*.supabase.co https://www.youtube.com https://vitals.vercel-insights.com",
```

#### 效果

- ✅ Vercel Analytics 脚本可以正常加载
- ✅ 可以收集用户分析数据
- ✅ 不再显示 CSP 违规错误

---

### 修复 2: Profiles 表（需要执行）

#### 步骤 1: 在 Supabase Dashboard 中运行 SQL

打开 Supabase Dashboard → SQL Editor，运行以下脚本：

```sql
-- 创建 profiles 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  topic_generation_mode TEXT DEFAULT 'smart' CHECK (topic_generation_mode IN ('smart', 'fast')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加 topic_generation_mode 列（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'topic_generation_mode'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN topic_generation_mode TEXT DEFAULT 'smart'
      CHECK (topic_generation_mode IN ('smart', 'fast'));
  END IF;
END $$;

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- 创建 RLS 策略
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 自动创建 profile 的函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 为现有用户创建 profiles
INSERT INTO public.profiles (id, email)
SELECT id, email
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
```

#### 步骤 2: 验证修复

运行以下查询验证：

```sql
-- 检查 profiles 表是否存在
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 检查现有 profiles 数量
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- 检查 RLS 策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles';
```

#### 步骤 3: 测试

1. 刷新应用页面
2. 检查控制台，确认 406 错误消失
3. 尝试更改主题生成模式（如果有相关 UI）

---

## 技术说明

### Content Security Policy (CSP)

CSP 是一种安全机制，用于防止 XSS 攻击和其他代码注入攻击。

**我们的 CSP 策略包括：**

- `script-src` - 允许加载脚本的来源
- `connect-src` - 允许发起网络请求的目标
- `img-src` - 允许加载图片的来源
- `frame-src` - 允许嵌入 iframe 的来源

**添加 Vercel Analytics：**
- `https://va.vercel-scripts.com` - Analytics 脚本
- `https://vitals.vercel-insights.com` - 性能监控数据上报

### Profiles 表结构

```sql
profiles (
  id UUID PRIMARY KEY,              -- 用户 ID（关联 auth.users）
  email TEXT,                        -- 用户邮箱
  full_name TEXT,                    -- 全名
  avatar_url TEXT,                   -- 头像 URL
  topic_generation_mode TEXT,        -- 主题生成模式：'smart' 或 'fast'
  created_at TIMESTAMPTZ,            -- 创建时间
  updated_at TIMESTAMPTZ             -- 更新时间
)
```

**topic_generation_mode 说明：**
- `smart` - 智能模式，生成更详细的主题
- `fast` - 快速模式，生成简洁的主题

### Row Level Security (RLS)

RLS 确保用户只能访问自己的 profile 数据：

```sql
-- 用户只能查看自己的 profile
USING (auth.uid() = id)

-- 用户只能更新自己的 profile
USING (auth.uid() = id)

-- 用户只能插入自己的 profile
WITH CHECK (auth.uid() = id)
```

---

## 已修改的文件

1. ✅ `middleware.ts` - 更新 CSP 策略
2. ✅ `supabase/migrations/fix_profiles_table.sql` - 创建 profiles 表修复脚本

---

## 测试清单

### Vercel Analytics
- [ ] 刷新页面
- [ ] 检查控制台无 CSP 错误
- [ ] 验证 Vercel Analytics 脚本加载成功

### Profiles 表
- [ ] 运行 SQL 修复脚本
- [ ] 验证表结构正确
- [ ] 检查 RLS 策略已创建
- [ ] 刷新应用页面
- [ ] 确认 406 错误消失
- [ ] 测试用户偏好设置功能

---

## 故障排查

### CSP 错误仍然出现

1. **清除浏览器缓存**
   ```
   Chrome: Cmd+Shift+Delete (Mac) / Ctrl+Shift+Delete (Windows)
   选择 "Cached images and files"
   ```

2. **重启开发服务器**
   ```bash
   # 停止服务器
   Ctrl+C
   
   # 重新启动
   npm run dev
   ```

3. **检查 middleware.ts 是否正确保存**
   ```bash
   cat middleware.ts | grep "va.vercel-scripts.com"
   ```

### Profiles 406 错误仍然出现

1. **检查表是否存在**
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'profiles';
   ```

2. **检查列是否存在**
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' 
     AND table_name = 'profiles'
     AND column_name = 'topic_generation_mode';
   ```

3. **检查 RLS 策略**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

4. **检查用户是否有 profile**
   ```sql
   SELECT * FROM public.profiles WHERE id = 'YOUR_USER_ID';
   ```

### 如果问题持续

查看 Supabase Dashboard 的 Logs 页面，查找详细错误信息。

---

## 相关文档

- [FIX_LOCAL_VIDEO_SAVE_ERROR.md](./FIX_LOCAL_VIDEO_SAVE_ERROR.md) - 本地视频保存错误
- [FIX_LOCAL_VIDEO_TRANSCRIPT_ISSUE.md](./FIX_LOCAL_VIDEO_TRANSCRIPT_ISSUE.md) - 字幕丢失问题
- [DATABASE_SETUP.md](../DATABASE_SETUP.md) - 数据库设置指南

---

## 安全注意事项

### CSP 最佳实践

- ✅ 只添加必需的域名
- ✅ 避免使用 `'unsafe-inline'` 和 `'unsafe-eval'`（但 YouTube 嵌入需要）
- ✅ 定期审查 CSP 策略
- ✅ 在生产环境使用更严格的策略

### RLS 最佳实践

- ✅ 始终为包含用户数据的表启用 RLS
- ✅ 使用 `auth.uid()` 验证用户身份
- ✅ 测试策略确保用户无法访问他人数据
- ✅ 为不同操作（SELECT、INSERT、UPDATE、DELETE）创建单独的策略

---

## 性能优化建议

### 1. 添加数据库索引

```sql
-- 已在修复脚本中包含
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
```

### 2. 缓存用户偏好

在客户端缓存 `topic_generation_mode`，减少数据库查询：

```typescript
// 示例代码
const [mode, setMode] = useState<string | null>(null);

useEffect(() => {
  const cached = localStorage.getItem('topic_generation_mode');
  if (cached) {
    setMode(cached);
  } else {
    // 从数据库获取
    fetchMode().then(m => {
      setMode(m);
      localStorage.setItem('topic_generation_mode', m);
    });
  }
}, []);
```

### 3. 批量操作

如果需要为多个用户创建 profiles，使用批量插入：

```sql
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
```
