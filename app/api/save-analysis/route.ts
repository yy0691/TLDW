import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { z } from 'zod';
import { formatValidationError } from '@/lib/validation';

const saveAnalysisSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  videoInfo: z.object({
    title: z.string(),
    author: z.string().optional(),
    duration: z.number().optional(),
    thumbnail: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional()
  }),
  transcript: z.array(z.object({
    text: z.string(),
    start: z.number(),
    duration: z.number()
  })),
  topics: z.array(z.any()),
  summary: z.string().nullable().optional(),
  suggestedQuestions: z.array(z.string()).nullable().optional(),
  model: z.string().default('gemini-2.5-flash')
});

async function handler(req: NextRequest) {
  try {
    const body = await req.json();

    let validatedData;
    try {
      validatedData = saveAnalysisSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: formatValidationError(error)
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const {
      videoId,
      videoInfo,
      transcript,
      topics,
      summary,
      model
    } = validatedData;

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    console.log('[Save Analysis] Attempting to save:', {
      videoId,
      title: videoInfo.title,
      hasUser: !!user,
      userId: user?.id,
      transcriptLength: transcript.length,
      topicsCount: topics.length
    });

    // Direct upsert into video_analyses to avoid RPC jsonb/text[] type issues
    const upsertData: any = {
      youtube_id: videoId,
      title: videoInfo.title,
      author: videoInfo.author || null,
      duration: videoInfo.duration || null,
      thumbnail_url: videoInfo.thumbnail || null,
      transcript,
      topics,
      summary: summary ?? null,
      suggested_questions: null,
      model_used: model,
      updated_at: new Date().toISOString(),
    };

    console.log('[Save Analysis] Upsert payload preview:', {
      ...upsertData,
      transcript: Array.isArray(transcript) ? `Array(${transcript.length})` : typeof transcript,
      topics: Array.isArray(topics) ? `Array(${topics.length})` : typeof topics,
    });

    const { data: result, error: saveError } = await supabase
      .from('video_analyses')
      .upsert(upsertData, { onConflict: 'youtube_id' })
      .select()
      .single();

    if (saveError) {
      console.error('[Save Analysis] Error details:', {
        message: saveError.message,
        code: saveError.code,
        details: saveError.details,
        hint: saveError.hint,
        videoId
      });
      return NextResponse.json(
        {
          error: 'Failed to save video analysis',
          details: saveError.message,
          code: saveError.code,
          hint: saveError.hint
        },
        { status: 500 }
      );
    }

    console.log('[Save Analysis] Success:', result);

    return NextResponse.json({
      success: true,
      saved: true,
      data: result
    });

  } catch (error) {
    console.error('Error in save analysis:', error);
    return NextResponse.json(
      { error: 'An error occurred while saving your analysis' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);