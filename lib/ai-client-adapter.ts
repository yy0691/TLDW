/**
 * Adapter to provide backward compatibility with existing gemini-client usage
 * while using the new Vercel AI SDK under the hood
 */

import { z } from 'zod';
import { generateWithAI, AIClientConfig } from './ai-client';
import { GenerationConfig } from '@google/generative-ai';

interface GeminiModelConfig {
  generationConfig?: GenerationConfig;
  preferredModel?: string;
  timeoutMs?: number;
  zodSchema?: z.ZodType<any>;
}

/**
 * Drop-in replacement for generateWithFallback that uses Vercel AI SDK
 * Supports user API keys when userId is provided
 */
export async function generateWithFallbackV2(
  prompt: string,
  config: GeminiModelConfig & { userId?: string } = {}
): Promise<string> {
  const aiConfig: AIClientConfig = {
    provider: 'google',
    model: config.preferredModel,
    temperature: config.generationConfig?.temperature,
    maxTokens: config.generationConfig?.maxOutputTokens,
    userId: config.userId,
  };

  try {
    const result = await generateWithAI({
      prompt,
      config: aiConfig,
      schema: config.zodSchema,
    });

    // If schema is provided, result will be an object, convert to JSON string
    if (config.zodSchema) {
      return JSON.stringify(result);
    }

    return result as string;
  } catch (error) {
    console.error('Error in generateWithFallbackV2:', error);
    throw error;
  }
}

/**
 * Helper to extract userId from request
 * This should be called in API routes that support user API keys
 */
export async function getUserIdFromRequest(): Promise<string | undefined> {
  try {
    const { createClient } = await import('./supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  } catch (error) {
    console.error('Error getting user from request:', error);
    return undefined;
  }
}
