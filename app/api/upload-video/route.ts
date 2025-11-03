import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { getWhisperClient } from '@/lib/whisper-client';
import { extractAudioFromFile, cleanupAudioFile, cleanupOldTempFiles } from '@/lib/audio-extractor';
import fs from 'fs';
import path from 'path';

/**
 * Video upload and subtitle generation API
 * Handles local video file uploads and generates subtitles using Whisper
 */
async function handler(request: NextRequest) {
  try {
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

    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const language = formData.get('language') as string | null;

    if (!videoFile) {
      return NextResponse.json(
        { error: 'Video file is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!allowedTypes.includes(videoFile.type)) {
      return NextResponse.json(
        { 
          error: 'Invalid file type',
          details: 'Only MP4, WebM, OGG, and MOV video files are supported.'
        },
        { status: 400 }
      );
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (videoFile.size > maxSize) {
      return NextResponse.json(
        { 
          error: 'File too large',
          details: 'Maximum file size is 500MB.'
        },
        { status: 400 }
      );
    }

    // Clean up old temp files first
    cleanupOldTempFiles();

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const videoId = `local_${Date.now()}`;
    const videoPath = path.join(tempDir, `video_${videoId}${path.extname(videoFile.name)}`);
    let audioPath: string | null = null;

    try {
      // Step 1: Save uploaded video file
      console.log(`[Upload-Video] Saving uploaded video: ${videoFile.name}`);
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      fs.writeFileSync(videoPath, buffer);

      // Step 2: Extract audio from video
      console.log(`[Upload-Video] Extracting audio from video`);
      audioPath = await extractAudioFromFile(videoPath, {
        maxDuration: 7200, // 2 hours max
        format: 'mp3',
        sampleRate: 16000,
      });

      // Step 3: Transcribe audio using Whisper
      console.log(`[Upload-Video] Transcribing audio with Whisper...`);
      const whisperClient = getWhisperClient();
      const transcript = await whisperClient.transcribe(audioPath, language || undefined);

      console.log(`[Upload-Video] Successfully generated ${transcript.length} segments`);

      // Get video metadata using ffprobe
      const [ffmpegModule, ffmpegPathModule] = await Promise.all([
        import('fluent-ffmpeg'),
        import('@ffmpeg-installer/ffmpeg'),
      ]);
      const ffmpegLib = ffmpegModule.default;
      ffmpegLib.setFfmpegPath(ffmpegPathModule.default.path);
      
      const metadata = await new Promise<any>((resolve, reject) => {
        ffmpegLib.ffprobe(videoPath, (err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const duration = metadata?.format?.duration || 0;
      const title = videoFile.name.replace(path.extname(videoFile.name), '');

      return NextResponse.json({
        videoId,
        title,
        duration: Math.floor(duration),
        transcript,
        source: 'local',
        language: language || 'auto',
      });
    } catch (error) {
      console.error('[Upload-Video] Error:', error);
      
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

      return NextResponse.json(
        { 
          error: 'Failed to process video',
          details: errorMessage
        },
        { status: 500 }
      );
    } finally {
      // Clean up temporary files
      if (videoPath && fs.existsSync(videoPath)) {
        cleanupAudioFile(videoPath);
      }
      if (audioPath) {
        cleanupAudioFile(audioPath);
      }
    }
  } catch (error) {
    console.error('[Upload-Video] Request error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

export const POST = withSecurity(handler, {
  ...SECURITY_PRESETS.PUBLIC,
  maxBodySize: 500 * 1024 * 1024, // 500MB for video uploads
});
