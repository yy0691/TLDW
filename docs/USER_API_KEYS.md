# User API Keys Feature

This feature allows users to provide their own AI API keys instead of relying on server-provided keys.

## Overview

Users can now add their own API keys for:
- **Google Gemini** - Used for video analysis, summaries, and AI chat
- **OpenAI** - Alternative AI provider for video analysis

## Benefits

1. **No rate limits** - Users can use their own API quotas
2. **Privacy** - Direct API calls using user's credentials
3. **Cost control** - Users pay for what they use
4. **Flexibility** - Choose between different AI providers

## How It Works

### For Users

1. **Navigate to Settings**
   - Go to `/settings` page when logged in
   
2. **Add API Key**
   - Select provider (Google or OpenAI)
   - Paste your API key
   - Click "Add API Key" or "Update API Key"

3. **Get API Keys**
   - **Google Gemini**: https://aistudio.google.com/app/apikey
   - **OpenAI**: https://platform.openai.com/api-keys

4. **Use the App**
   - When you analyze videos, your API key will be used automatically
   - If no API key is set, server keys are used (subject to rate limits)

### For Developers

#### Database Schema

A new table `user_api_keys` stores encrypted API keys:

```sql
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  provider TEXT CHECK (provider IN ('google', 'openai')),
  api_key_encrypted TEXT NOT NULL,
  api_key_preview TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);
```

#### API Endpoints

**GET /api/user/api-keys**
- Fetch user's API keys (masked)
- Returns: `{ apiKeys: ApiKey[] }`

**POST /api/user/api-keys**
- Save/update API key
- Body: `{ provider: 'google' | 'openai', apiKey: string }`
- Returns: `{ success: true, apiKey: ApiKey }`

**DELETE /api/user/api-keys?provider={provider}**
- Delete user's API key
- Returns: `{ success: true }`

#### Using in API Routes

```typescript
import { generateWithAI } from '@/lib/ai-client';
import { createClient } from '@/lib/supabase/server';

// Get user ID from request
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

// Generate with AI (automatically uses user's API key if available)
const result = await generateWithAI({
  prompt: 'Your prompt here',
  config: {
    provider: 'google',
    userId: user?.id, // Optional: if provided, uses user's API key
  },
});
```

#### Backward Compatibility

For existing code using `generateWithFallback`, you can use the adapter:

```typescript
import { generateWithFallbackV2, getUserIdFromRequest } from '@/lib/ai-client-adapter';

const userId = await getUserIdFromRequest();

const response = await generateWithFallbackV2(prompt, {
  generationConfig: { temperature: 0.7 },
  zodSchema: mySchema,
  userId, // Pass userId to use user's API key
});
```

## Security

- API keys are encrypted using AES-256-GCM before storage
- Encryption key must be set in `API_KEY_ENCRYPTION_SECRET` env variable
- Only the owning user can access their API keys
- RLS policies enforce user isolation

## Environment Variables

Add to `.env.local`:

```bash
# Required: 32-byte hex string for encrypting user API keys
API_KEY_ENCRYPTION_SECRET=your_64_char_hex_string_here

# Optional: Server fallback keys (used when user has no API key)
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
```

Generate encryption secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Migration

Run the database migration:

```bash
supabase migration up
```

Or apply the SQL file:
```bash
psql -f supabase/migrations/20241105000000_add_user_api_keys.sql
```

## Future Enhancements

- Support for more AI providers (Anthropic Claude, etc.)
- Usage tracking and cost estimation
- API key validation on save
- Automatic fallback to server keys on user key failure
