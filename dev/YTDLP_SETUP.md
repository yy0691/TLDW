# yt-dlp 安装和配置指南

## 什么是 yt-dlp？

yt-dlp 是一个免费开源的命令行工具，可以从 YouTube、Bilibili 等多个视频平台下载视频和字幕。本项目使用它作为免费的字幕获取方案，替代付费的 Supadata API。

## 安装步骤

### Windows

**方法 1：使用 winget（推荐）**
```bash
winget install yt-dlp
```

**方法 2：使用 scoop**
```bash
scoop install yt-dlp
```

**方法 3：手动安装**
1. 下载 [yt-dlp.exe](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe)
2. 将 `yt-dlp.exe` 放到系统 PATH 中的任意目录（如 `C:\Windows\System32`）

### macOS

**使用 Homebrew**
```bash
brew install yt-dlp
```

### Linux

**使用 pip**
```bash
pip install yt-dlp
```

**或使用包管理器**
```bash
# Ubuntu/Debian
sudo apt install yt-dlp

# Arch Linux
sudo pacman -S yt-dlp
```

## 验证安装

安装完成后，在终端运行：
```bash
yt-dlp --version
```

如果显示版本号，说明安装成功。

## 工作原理

1. **主要方式**：项目首先尝试使用 Supadata API 获取字幕（需要 `SUPADATA_API_KEY`）
2. **免费备用方案**：如果 Supadata 失败（如视频没有字幕或 API key 未配置），自动使用 yt-dlp 获取字幕
3. **支持平台**：YouTube、Bilibili、以及 yt-dlp 支持的其他 1000+ 网站

## 功能特性

- ✅ **完全免费**：无需 API key，无使用限制
- ✅ **支持多语言**：自动尝试中文、英文等多种语言字幕
- ✅ **自动字幕**：支持 YouTube 自动生成的字幕
- ✅ **广泛支持**：YouTube、Bilibili、Twitter、TikTok 等 1000+ 网站
- ✅ **本地处理**：字幕在服务器本地提取，无需外部 API

## 配置选项

在 `.env.local` 中：

```bash
# Supadata API（可选，如果有的话优先使用）
SUPADATA_API_KEY=your-supadata-key

# 不需要配置任何 yt-dlp 相关的环境变量
# 只要系统安装了 yt-dlp，项目会自动检测并使用
```

## 使用示例

当你在项目中输入视频 URL 时：

1. **有 Supadata key**：先用 Supadata 获取字幕（快速）
2. **Supadata 失败**：自动切换到 yt-dlp（稍慢但免费）
3. **两者都失败**：返回 404 错误

控制台会显示：
```
[Transcript] Supadata failed, attempting yt-dlp fallback for video: xxx
[yt-dlp] Successfully extracted 245 subtitle segments
```

## 临时目录

yt-dlp 会在 `temp/ytdlp/` 目录下临时存储字幕文件，处理完成后自动清理。

## 故障排除

### 问题：命令找不到
**解决**：确保 yt-dlp 在系统 PATH 中
```bash
# Windows
where yt-dlp

# macOS/Linux
which yt-dlp
```

### 问题：字幕提取失败
**可能原因**：
- 视频没有字幕
- 视频是私有或地区限制
- yt-dlp 版本过旧

**解决**：更新 yt-dlp
```bash
# Windows (winget)
winget upgrade yt-dlp

# macOS
brew upgrade yt-dlp

# Linux
pip install --upgrade yt-dlp
```

### 问题：速度慢
yt-dlp 需要下载字幕文件，比 API 调用稍慢（通常 5-15 秒）。这是正常现象。

## 移除 Whisper 依赖（可选）

如果不需要 Whisper 功能，可以移除相关依赖以减小项目体积：

```bash
pnpm remove openai fluent-ffmpeg @ffmpeg-installer/ffmpeg @types/fluent-ffmpeg ytdl-core
```

然后删除以下文件：
- `lib/whisper-client.ts`
- `lib/audio-extractor.ts`

## 更多信息

- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [支持的网站列表](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
