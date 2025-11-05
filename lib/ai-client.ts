import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, LanguageModel } from 'ai';
import { z } from 'zod';
import { decryptApiKey } from './api-key-encryption';
import { createClient } from './supabase/server';

export type AIProvider = 'google' | 'openai';

export interface AIClientConfig {
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  userId?: string;
}

// Default models for each provider
const DEFAULT_MODELS = {
  google: 'gemini-2.5-flash-lite',
  openai: 'gpt-4o-mini',
} as const;

// Model fallback cascade for Google
const GOOGLE_MODEL_CASCADE = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
] as const;

async function getUserApiKey(userId: string, provider: AIProvider): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('api_key_encrypted, is_active')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return decryptApiKey(data.api_key_encrypted);
  } catch (error) {
    console.error('Error fetching user API key:', error);
    return null;
  }
}

function getServerApiKey(provider: AIProvider): string | null {
  if (provider === 'google') {
    return process.env.GEMINI_API_KEY || null;
  }
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY || null;
  }
  return null;
}

export async function createAIClient(config: AIClientConfig = {}): Promise<LanguageModel> {
  const provider = config.provider || 'google';
  const userId = config.userId;
  
  // Try to get user's API key first, fallback to server key
  let apiKey: string | null = null;
  
  if (userId) {
    apiKey = await getUserApiKey(userId, provider);
  }
  
  if (!apiKey) {
    apiKey = getServerApiKey(provider);
  }
  
  if (!apiKey) {
    throw new Error(`No API key available for provider: ${provider}`);
  }
  
  const model = config.model || DEFAULT_MODELS[provider];
  
  if (provider === 'google') {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(model);
  }
  
  if (provider === 'openai') {
    const openai = createOpenAI({ apiKey });
    return openai(model);
  }
  
  throw new Error(`Unsupported provider: ${provider}`);
}

export interface GenerateWithAIOptions {
  prompt: string;
  config?: AIClientConfig;
  schema?: z.ZodType<any>;
  system?: string;
}

export async function generateWithAI<T = string>(
  options: GenerateWithAIOptions
): Promise<T> {
  const { prompt, config = {}, schema, system } = options;
  const provider = config.provider || 'google';
  
  // For Google, try cascade of models
  if (provider === 'google') {
    const models = config.model 
      ? [config.model, ...GOOGLE_MODEL_CASCADE.filter(m => m !== config.model)]
      : [...GOOGLE_MODEL_CASCADE];
    
    let lastError: any;
    
    for (const model of models) {
      try {
        const modelInstance = await createAIClient({ ...config, model });
        
        const generateOptions: any = {
          model: modelInstance,
          prompt,
          temperature: config.temperature || 0.7,
        };
        
        if (config.maxTokens) {
          generateOptions.maxTokens = config.maxTokens;
        }
        
        if (system) {
          generateOptions.system = system;
        }
        
        // Use experimental_output for structured output
        if (schema) {
          generateOptions.experimental_output = schema;
          const result = await generateText(generateOptions);
          return result.experimental_output as T;
        }
        
        const result = await generateText(generateOptions);
        return result.text as T;
        
      } catch (error: any) {
        lastError = error;
        console.log(`Model ${model} failed, trying next...`, error.message);
        
        // If it's not a retryable error, throw immediately
        if (!isRetryableError(error)) {
          throw error;
        }
      }
    }
    
    throw new Error(
      `All Google models failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }
  
  // For OpenAI or single model attempt
  const modelInstance = await createAIClient(config);
  
  const generateOptions: any = {
    model: modelInstance,
    prompt,
    temperature: config.temperature || 0.7,
  };
  
  if (config.maxTokens) {
    generateOptions.maxTokens = config.maxTokens;
  }
  
  if (system) {
    generateOptions.system = system;
  }
  
  // Use experimental_output for structured output
  if (schema) {
    generateOptions.experimental_output = schema;
    const result = await generateText(generateOptions);
    return result.experimental_output as T;
  }
  
  const result = await generateText(generateOptions);
  return result.text as T;
}

function isRetryableError(error: any): boolean {
  const status = error?.status || error?.statusCode;
  const message = error?.message || '';
  
  return (
    status === 503 ||
    status === 429 ||
    message.includes('503') ||
    message.includes('429') ||
    message.includes('overload') ||
    message.includes('rate limit')
  );
}
