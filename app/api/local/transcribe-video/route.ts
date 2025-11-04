import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
<<<<<<< Updated upstream
=======
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
    // For now, return an error message explaining that automatic transcription
    // requires either:
    // 1. A subtitle file to be uploaded manually, OR
    // 2. A local speech-to-text service to be configured
    //
    // This prevents the OpenAI API dependency while keeping the code structure
    return NextResponse.json(
      {
        error: 'Automatic transcription not available',
        details: 'Please provide a subtitle file (SRT or VTT format) for local video uploads. Automatic speech-to-text transcription requires additional setup.',
        suggestion: 'You can generate subtitles using free tools like:\n- Subtitle Edit (https://www.nikse.dk/subtitleedit)\n- Aegisub (https://aegisub.org/)\n- Or online services like YouTube Studio'
      },
      { status: 501 } // 501 Not Implemented
    );

    // TODO: Implement local transcription using one of these options:
    // 1. Whisper.cpp (local C++ implementation, no API costs)
    // 2. Vosk (offline speech recognition)
    // 3. Mozilla DeepSpeech (deprecated but still works)
    // 4. Faster-Whisper (optimized local Whisper)
    //
    // Example implementation with Whisper.cpp would go here:
    /*
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Extract audio from video
    const audioPath = await extractAudioFromVideo(videoUrl);
    
    // Run whisper.cpp
    const { stdout } = await execAsync(
      `whisper-cpp -m models/ggml-base.bin -f ${audioPath} --output-srt`
    );
    
    // Parse SRT output and return transcript
    const transcript = parseSrtToTranscript(stdout);
    return NextResponse.json({ transcript });
    */
=======
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
>>>>>>> Stashed changes

  } catch (error) {
    console.error('Transcribe video error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe video' },
      { status: 500 }
    );
  }
}

<<<<<<< Updated upstream
=======
export const runtime = 'nodejs';
>>>>>>> Stashed changes
export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);
