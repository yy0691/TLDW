# Custom AI Providers Guide

This guide explains how to configure and use custom AI providers in TLDW.

## Overview

TLDW supports three types of AI providers:

1. **Google Gemini** - Default provider for analysis and chat
2. **OpenAI** - Alternative provider
3. **Custom Providers** - Any OpenAI-compatible API endpoint

## Supported Chinese AI Providers

The following Chinese AI providers are pre-configured with presets:

### 1. DeepSeek (深度求索)
- **Base URL**: `https://api.deepseek.com/v1`
- **Default Model**: `deepseek-chat`
- **Get API Key**: [https://platform.deepseek.com/](https://platform.deepseek.com/)

### 2. Zhipu AI (智谱清言)
- **Base URL**: `https://open.bigmodel.cn/api/paas/v4`
- **Default Model**: `glm-4`
- **Get API Key**: [https://open.bigmodel.cn/](https://open.bigmodel.cn/)

### 3. Alibaba Qwen (通义千问)
- **Base URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **Default Model**: `qwen-plus`
- **Get API Key**: [https://dashscope.console.aliyun.com/](https://dashscope.console.aliyun.com/)

### 4. Moonshot AI (月之暗面)
- **Base URL**: `https://api.moonshot.cn/v1`
- **Default Model**: `moonshot-v1-8k`
- **Get API Key**: [https://platform.moonshot.cn/](https://platform.moonshot.cn/)

### 5. ByteDance Doubao (豆包)
- **Base URL**: `https://ark.cn-beijing.volces.com/api/v3`
- **Default Model**: `doubao-pro-32k`
- **Get API Key**: [https://console.volcengine.com/](https://console.volcengine.com/)

## How to Add a Custom Provider

### Using Presets (Recommended)

1. Go to **Settings** page
2. Click on **AI API Keys** section
3. Select **Custom Provider (中国大模型)** from the dropdown
4. Choose one of the preset providers (e.g., DeepSeek, Zhipu AI)
5. The form will auto-fill with the provider's base URL and default model
6. Enter your API key
7. Click **Add API Key**

### Manual Configuration

If your provider is not in the presets, you can configure it manually:

1. Go to **Settings** page
2. Click on **AI API Keys** section
3. Select **Custom Provider (中国大模型)** from the dropdown
4. **Don't select a preset** - leave it blank
5. Fill in the following fields:
   - **Provider Name**: A display name (e.g., "My Custom AI")
   - **Base URL**: The API endpoint (must be OpenAI-compatible)
   - **Model Name**: The model identifier
   - **API Key**: Your API key
6. Click **Add API Key**

## Technical Details

### Database Schema

Custom provider configurations are stored in the `user_api_keys` table with the following fields:

```sql
- id: UUID
- user_id: UUID (foreign key to auth.users)
- provider: TEXT (identifier: 'deepseek', 'zhipu', 'custom', etc.)
- provider_name: TEXT (display name)
- api_key_encrypted: TEXT (AES-256-GCM encrypted)
- api_key_preview: TEXT (last 4 characters for display)
- base_url: TEXT (custom API endpoint)
- model_name: TEXT (model identifier)
- is_active: BOOLEAN
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### API Integration

The system uses the Vercel AI SDK's OpenAI adapter with custom `baseURL`:

```typescript
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: userApiKey,
  baseURL: customBaseUrl, // e.g., 'https://api.deepseek.com/v1'
});

const model = openai(modelName); // e.g., 'deepseek-chat'
```

### Fallback Behavior

When a user's API key is configured:

1. System first attempts to use the user's API key
2. If the user's key fails or is not configured, falls back to server API keys
3. For Google Gemini, uses model cascade: `gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gemini-2.5-pro`

## OpenAI-Compatible APIs

To be compatible with TLDW, a custom provider must implement the OpenAI Chat Completions API:

- **Endpoint**: `{baseURL}/chat/completions`
- **Method**: `POST`
- **Headers**: 
  - `Authorization: Bearer {apiKey}`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "model": "model-name",
    "messages": [
      { "role": "user", "content": "..." }
    ],
    "temperature": 0.7,
    "max_tokens": 4096
  }
  ```

## Security

- All API keys are encrypted using AES-256-GCM before storage
- Encryption secret is configured in `API_KEY_ENCRYPTION_SECRET` environment variable
- API keys are only decrypted server-side when needed for API calls
- Row-level security (RLS) ensures users can only access their own API keys

## Usage Statistics

When using your own API keys:

- You are charged directly by your AI provider
- TLDW's server rate limits do not apply
- Your usage is tracked by your provider's dashboard
- Server API keys are used as fallback if your key fails

## Migration

If you have an existing deployment, run the migration:

```bash
npx supabase migration up
```

Or apply the migration file manually:
- `supabase/migrations/20241220000000_add_custom_provider_support.sql`

## Troubleshooting

### API Key Not Loading

1. Check browser console for errors
2. Verify API key is saved in Settings
3. Try deleting and re-adding the API key

### Custom Provider Not Working

1. Verify the base URL is correct and includes the version (e.g., `/v1`)
2. Ensure the model name matches your provider's documentation
3. Check that your API key has sufficient credits
4. Verify the provider's API is OpenAI-compatible

### Rate Limiting

If you experience rate limiting:

1. Your custom provider may have usage limits - check their dashboard
2. Consider upgrading your provider's plan
3. Server fallback keys have separate rate limits

## Examples

### Example 1: Using DeepSeek

```
Provider: deepseek
Provider Name: DeepSeek
Base URL: https://api.deepseek.com/v1
Model Name: deepseek-chat
API Key: sk-xxxxxxxxxxxxxxxxxxxxx
```

### Example 2: Using Zhipu AI

```
Provider: zhipu
Provider Name: Zhipu AI (智谱)
Base URL: https://open.bigmodel.cn/api/paas/v4
Model Name: glm-4
API Key: xxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxx
```

## Support

For issues or questions:

1. Check the [main documentation](../README.md)
2. Review [CLAUDE.md](../CLAUDE.md) for architecture details
3. Open an issue on GitHub
