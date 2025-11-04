import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { generateWithFallback } from '@/lib/gemini-client';
import { TranscriptSegment, TranscriptLanguage } from '@/lib/types';
import { z } from 'zod';

const TranscriptSegmentSchema = z.object({
  text: z.string(),
  start: z.number(),
  duration: z.number(),
  originalText: z.string().optional(),
  language: z.string().optional(),
});

const TranslatedSegmentsSchema = z.object({
  translations: z.array(z.object({
    index: z.number(),
    translatedText: z.string(),
  })),
});

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, targetLanguage, sourceLanguage } = body;

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json(
        { error: 'Transcript is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'Target language is required' },
        { status: 400 }
      );
    }

    // Validate supported language pairs
    const supportedTargets: TranscriptLanguage[] = ['zh-CN'];
    if (!supportedTargets.includes(targetLanguage as TranscriptLanguage)) {
      return NextResponse.json(
        { error: `Target language "${targetLanguage}" is not supported. Supported: ${supportedTargets.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[Translate] Translating ${transcript.length} segments from ${sourceLanguage || 'auto'} to ${targetLanguage}`);

    // Get language names for the prompt
    const languageNames: Record<string, string> = {
      'en': 'English',
      'zh-CN': 'Simplified Chinese',
      'zh-TW': 'Traditional Chinese',
    };

    const targetLanguageName = languageNames[targetLanguage] || targetLanguage;
    const sourceLanguageName = sourceLanguage ? languageNames[sourceLanguage] || sourceLanguage : 'the source language';

    // Process in batches to avoid token limits
    const BATCH_SIZE = 50;
    const translatedSegments: TranscriptSegment[] = [...transcript];
    
    for (let i = 0; i < transcript.length; i += BATCH_SIZE) {
      const batch = transcript.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map((seg: TranscriptSegment, idx: number) => ({
        index: i + idx,
        text: seg.text,
      }));

      const prompt = `You are a professional translator. Translate the following video transcript segments from ${sourceLanguageName} to ${targetLanguageName}.

IMPORTANT INSTRUCTIONS:
1. Maintain the meaning and tone of the original text
2. Keep technical terms accurate
3. Preserve timestamps and structure
4. For English to Simplified Chinese: Use natural, fluent Chinese expressions
5. For Traditional Chinese to Simplified Chinese: Convert characters accurately while maintaining meaning
6. Do NOT add extra explanations or notes
7. Return ONLY the translated text for each segment

Transcript segments to translate:
${batchTexts.map(({ index, text }) => `[${index}]: ${text}`).join('\n\n')}

Return the translations in JSON format with the following structure:
{
  "translations": [
    { "index": 0, "translatedText": "translated text here" },
    ...
  ]
}`;

      try {
        const response = await generateWithFallback(prompt, {
          zodSchema: TranslatedSegmentsSchema,
          timeoutMs: 60000, // 60 seconds timeout for translation
        });

        const parsed = JSON.parse(response);
        const validated = TranslatedSegmentsSchema.parse(parsed);

        // Update translated segments
        for (const translation of validated.translations) {
          const originalIndex = translation.index;
          if (originalIndex >= 0 && originalIndex < translatedSegments.length) {
            translatedSegments[originalIndex] = {
              ...translatedSegments[originalIndex],
              originalText: translatedSegments[originalIndex].originalText || translatedSegments[originalIndex].text,
              text: translation.translatedText,
              language: targetLanguage as TranscriptLanguage,
            };
          }
        }

        console.log(`[Translate] Batch ${Math.floor(i / BATCH_SIZE) + 1} completed: ${validated.translations.length} segments`);
      } catch (error) {
        console.error(`[Translate] Error translating batch starting at ${i}:`, error);
        // Continue with next batch instead of failing completely
      }
    }

    return NextResponse.json({
      transcript: translatedSegments,
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage,
      segmentCount: translatedSegments.length,
    });
  } catch (error) {
    console.error('[Translate] Translation failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to translate transcript',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);
