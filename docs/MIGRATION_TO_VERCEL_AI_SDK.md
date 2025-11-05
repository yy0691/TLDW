# Migration Guide: Vercel AI SDK Integration

This guide helps developers migrate existing API routes to support user-provided API keys using Vercel AI SDK.

## Overview

The project now supports two AI client implementations:
- **Legacy**: `lib/gemini-client.ts` - Original Google Generative AI SDK
- **New**: `lib/ai-client.ts` - Vercel AI SDK with user API key support

Both can coexist during migration. The new client automatically uses user API keys when available and falls back to server keys.

## Quick Start for New Routes

For new API routes, use the Vercel AI SDK directly:

```typescript
import { generateWithAI } from '@/lib/ai-client';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Get user ID
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { prompt } = await request.json();
  
  // Generate with AI (uses user's key if available)
  const result = await generateWithAI({
    prompt,
    config: {
      provider: 'google',
      userId: user?.id,
      temperature: 0.7,
    },
  });
  
  return NextResponse.json({ result });
}
```

## Migrating Existing Routes

### Option 1: Use Adapter (Minimal Changes)

For routes already using `generateWithFallback`, use the adapter:

```typescript
// Before
import { generateWithFallback } from '@/lib/gemini-client';

const response = await generateWithFallback(prompt, {
  generationConfig: { temperature: 0.7 },
  zodSchema: mySchema,
});

// After
import { generateWithFallbackV2, getUserIdFromRequest } from '@/lib/ai-client-adapter';

const userId = await getUserIdFromRequest();

const response = await generateWithFallbackV2(prompt, {
  generationConfig: { temperature: 0.7 },
  zodSchema: mySchema,
  userId, // Add this to support user API keys
});
```

### Option 2: Full Migration (Recommended)

For better control and features, migrate to the new client:

```typescript
// Before
import { generateWithFallback } from '@/lib/gemini-client';

const response = await generateWithFallback(prompt, {
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 2000,
  },
  zodSchema: mySchema,
  preferredModel: 'gemini-2.5-flash',
});

const parsed = JSON.parse(response);

// After
import { generateWithAI } from '@/lib/ai-client';
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

const result = await generateWithAI({
  prompt,
  config: {
    provider: 'google',
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
    userId: user?.id,
  },
  schema: mySchema, // Returns typed object directly
});

// result is already parsed and typed
```

## Key Differences

### Response Format

**Legacy Client:**
```typescript
const response = await generateWithFallback(prompt, { zodSchema });
const parsed = JSON.parse(response); // Returns string, must parse
```

**New Client:**
```typescript
const result = await generateWithAI({ prompt, schema }); // Returns typed object
```

### Error Handling

**Legacy Client:**
```typescript
try {
  const response = await generateWithFallback(prompt);
} catch (error) {
  // Model cascade happens automatically
}
```

**New Client:**
```typescript
try {
  const result = await generateWithAI({ prompt, config });
  // Model cascade still happens for Google provider
  // User API key fallback to server key is automatic
} catch (error) {
  // Handle final error after all retries
}
```

### Configuration Mapping

| Legacy | New | Notes |
|--------|-----|-------|
| `generationConfig.temperature` | `config.temperature` | Direct mapping |
| `generationConfig.maxOutputTokens` | `config.maxTokens` | Renamed |
| `preferredModel` | `config.model` | Renamed |
| `zodSchema` | `schema` | Shortened |
| N/A | `config.userId` | New: enables user API keys |
| N/A | `config.provider` | New: supports multiple providers |

## Example Migrations

### Example 1: Generate Topics Route

**Before (`/api/generate-topics/route.ts`):**
```typescript
import { generateWithFallback } from '@/lib/gemini-client';

const response = await generateWithFallback(prompt, {
  generationConfig: { temperature: 0.6 },
  zodSchema: topicsSchema,
});

const parsed = JSON.parse(response);
const topics = parsed.topics;
```

**After:**
```typescript
import { generateWithAI } from '@/lib/ai-client';
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

const result = await generateWithAI<{ topics: Topic[] }>({
  prompt,
  config: {
    provider: 'google',
    temperature: 0.6,
    userId: user?.id,
  },
  schema: topicsSchema,
});

const topics = result.topics;
```

### Example 2: Chat Route

**Before (`/api/chat/route.ts`):**
```typescript
import { generateWithFallback } from '@/lib/gemini-client';

const response = await generateWithFallback(prompt, {
  generationConfig: { temperature: 0.7 },
  zodSchema: chatResponseSchema,
});
```

**After:**
```typescript
import { generateWithAI } from '@/lib/ai-client';
import { getUserIdFromRequest } from '@/lib/ai-client-adapter';

const userId = await getUserIdFromRequest();

const result = await generateWithAI({
  prompt,
  config: {
    provider: 'google',
    temperature: 0.7,
    userId,
  },
  schema: chatResponseSchema,
});
```

## Testing User API Keys

### 1. Generate Encryption Key
```bash
npm run generate-key
```

Add the output to `.env.local`.

### 2. Run Database Migration
```bash
# Apply the migration SQL file to your Supabase project
```

### 3. Add Test API Key
1. Start the dev server: `npm run dev`
2. Sign in to your account
3. Go to Settings → AI API Keys
4. Add your Google Gemini API key
5. Test by analyzing a video

### 4. Verify Usage
Check console logs to see which API key was used:
```
[AI Client] Using user API key for provider: google
```

Or for fallback:
```
[AI Client] Using server API key for provider: google
```

## Rollback Plan

If issues arise, you can temporarily disable user API keys by:

1. Comment out the user key lookup in `lib/ai-client.ts`:
```typescript
async function getUserApiKey(userId: string, provider: AIProvider): Promise<string | null> {
  return null; // Force server key usage
}
```

2. Or revert to legacy client by changing imports back to `@/lib/gemini-client`.

## Performance Considerations

- User API keys are cached per request (no repeated database lookups)
- Encryption/decryption adds ~1ms per request
- Model cascade still applies for Google provider
- No performance difference for users without custom keys

## Security Checklist

- ✅ API keys encrypted with AES-256-GCM
- ✅ RLS policies enforce user isolation
- ✅ No API keys exposed in logs or responses
- ✅ HTTPS required for API key submission
- ✅ Keys only accessible by owning user

## Next Steps

1. ✅ Set up `API_KEY_ENCRYPTION_SECRET` in environment
2. ✅ Apply database migration
3. ⏳ Gradually migrate API routes using adapter
4. ⏳ Test with real user API keys
5. ⏳ Monitor error logs for fallback behavior
6. ⏳ Update documentation for users

## Support

- Technical documentation: `/docs/USER_API_KEYS.md`
- User guide (Chinese): `/docs/USER_API_KEYS_CN.md`
- Example code: Check existing routes for patterns
