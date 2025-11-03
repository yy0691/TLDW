import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { getWhisperClient } from '@/lib/whisper-client';
import { extractAudioFromYouTube, cleanupAudioFile, cleanupOldTempFiles } from '@/lib/audio-extractor';
import { extractVideoId } from '@/lib/utils';

/**
 * Auto subtitle generation API
 * Extracts audio from YouTube video and generates subtitles using Whisper
 */
async function handler(request: NextRequest) {
  try {
    const { url, language } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Automatic subtitle recognition is not configured',
          details: 'OpenAI API key is missing. Please configure OPENAI_API_KEY in environment variables.'
        },
        { status: 503 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    // Clean up old temp files first
    cleanupOldTempFiles();

    let audioPath: string | null = null;

    try {
      // Step 1: Extract audio from YouTube
      console.log(`[Auto-Subtitle] Extracting audio from video: ${videoId}`);
      audioPath = await extractAudioFromYouTube(videoId, {
        maxDuration: 7200, // 2 hours max
        format: 'mp3',
        sampleRate: 16000,
      });

      // Step 2: Transcribe audio using Whisper
      console.log(`[Auto-Subtitle] Transcribing audio with Whisper...`);
      const whisperClient = getWhisperClient();
      const transcript = await whisperClient.transcribe(audioPath, language);

      console.log(`[Auto-Subtitle] Successfully generated ${transcript.length} segments`);

      return NextResponse.json({
        videoId,
        transcript,
        source: 'whisper',
        language: language || 'auto',
      });
    } catch (error) {
      console.error('[Auto-Subtitle] Error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle specific errors
      if (errorMessage.includes('too long')) {
        return NextResponse.json(
          { 
            error: 'Video is too long',
            details: 'The video exceeds the maximum duration limit for automatic subtitle generation (2 hours).'
          },
          { status: 400 }
        );
      }

      if (errorMessage.includes('private') || errorMessage.includes('unavailable')) {
        return NextResponse.json(
          { 
            error: 'Video unavailable',
            details: 'The video is private, unavailable, or cannot be accessed.'
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { 
          error: 'Failed to generate automatic subtitles',
          details: errorMessage
        },
        { status: 500 }
      );
    } finally {
      // Clean up audio file
      if (audioPath) {
        cleanupAudioFile(audioPath);
      }
    }
  } catch (error) {
    console.error('[Auto-Subtitle] Request error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);
