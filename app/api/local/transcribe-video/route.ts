import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

async function handler(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoUrl = formData.get('videoUrl') as string;
    const videoId = formData.get('videoId') as string;

    if (!videoUrl || !videoId) {
      return NextResponse.json(
        { error: 'Video URL and ID are required' },
        { status: 400 }
      );
    }

    const pythonExecutable = process.env.FASTER_WHISPER_PYTHON_PATH || 'python';
    const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe_faster_whisper.py');

    try {
      const { stdout } = await execFileAsync(pythonExecutable, [
        scriptPath,
        '--video-url',
        videoUrl,
      ], {
        env: {
          ...process.env,
        },
        maxBuffer: 1024 * 1024 * 20, // 20MB buffer for transcription output
      });

      const parsed = JSON.parse(stdout.toString());

      if (!parsed || !Array.isArray(parsed.segments)) {
        throw new Error('Invalid transcription response');
      }

      return NextResponse.json({
        videoId,
        transcript: parsed.segments,
        source: 'faster-whisper',
        fallback: true,
      });
    } catch (error) {
      console.error('Faster-Whisper transcription failed:', error);

      return NextResponse.json(
        {
          error: 'Automatic transcription failed',
          details:
            error instanceof Error
              ? error.message
              : 'Unknown error while running faster-whisper command.',
          suggestion:
            'Ensure Python, ffmpeg, and faster-whisper are installed. Alternatively, upload a subtitle file (SRT or VTT).',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Transcribe video error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe video' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);
