# 用户 API Key 自助配置功能

## 功能说明

现在您可以使用自己的 AI 提供商 API key，而不需要依赖服务器提供的 key。这样您就可以：

- ✅ **无限制使用** - 使用自己的 API 配额，不受服务器限制
- ✅ **隐私保护** - 直接调用 AI API，使用您自己的凭证
- ✅ **成本控制** - 按需付费，完全掌控使用成本
- ✅ **灵活选择** - 支持多个 AI 提供商（Google Gemini、OpenAI）

## 支持的 AI 提供商

### Google Gemini
- 用途：视频分析、摘要生成、AI 对话
- 获取 API Key：https://aistudio.google.com/app/apikey

### OpenAI
- 用途：视频分析的备选方案
- 获取 API Key：https://platform.openai.com/api-keys

## 使用步骤

### 1. 登录账号
首先需要登录您的账号才能配置 API Key。

### 2. 进入设置页面
点击右上角用户菜单，选择 "Settings"（设置）。

### 3. 添加 API Key
在设置页面的 "AI API Keys" 卡片中：

1. 选择 AI 提供商（Google 或 OpenAI）
2. 点击 "Get API Key" 链接获取您的 API key
3. 将 API key 粘贴到输入框中
4. 点击 "Add API Key" 或 "Update API Key" 按钮保存

### 4. 开始使用
配置完成后，当您分析视频时：
- 系统会自动使用您配置的 API key
- 如果未配置 API key，则使用服务器提供的 key（受限制）

### 5. 管理 API Key
- **查看**：在设置页面可以看到已配置的 API key（已加密显示）
- **更新**：输入新的 key 并保存即可更新
- **删除**：点击垃圾桶图标删除 API key

## 安全说明

- 🔒 您的 API key 使用 AES-256-GCM 加密存储
- 🔒 只有您自己可以访问您的 API key
- 🔒 API key 仅在分析视频时使用，不会泄露给其他用户

## 费用说明

使用自己的 API key 时：
- Google Gemini 提供免费配额，超出后按使用量计费
- OpenAI 按使用量计费
- 具体费用请查看各提供商的定价页面

## 常见问题

**Q: 必须配置 API key 才能使用吗？**
A: 不是。如果不配置，系统会使用服务器提供的默认 key，但可能有使用限制。

**Q: 我的 API key 安全吗？**
A: 是的，API key 经过加密存储，只有您自己可以访问。

**Q: 可以同时配置多个提供商的 key 吗？**
A: 可以。您可以同时配置 Google Gemini 和 OpenAI 的 key。

**Q: 配置后立即生效吗？**
A: 是的，保存后立即生效，下次分析视频时就会使用您的 key。

**Q: 如何知道使用了多少配额？**
A: 请登录到对应 AI 提供商的控制台查看使用情况。

## 技术支持

如遇问题，请查看：
- [完整文档](USER_API_KEYS.md)（英文）
- [GitHub Issues](https://github.com/yourusername/tldw/issues)
