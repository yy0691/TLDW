import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';

// Lazy load ffmpeg to avoid build issues
let ffmpegInstance: any = null;

async function getFfmpeg(): Promise<any> {
  if (!ffmpegInstance) {
    // Dynamic imports to avoid build-time issues
    const [ffmpegModule, ffmpegPathModule] = await Promise.all([
      import('fluent-ffmpeg'),
      import('@ffmpeg-installer/ffmpeg'),
    ]);
    const ffmpeg = ffmpegModule.default;
    ffmpeg.setFfmpegPath(ffmpegPathModule.default.path);
    ffmpegInstance = ffmpeg;
  }
  return ffmpegInstance;
}

export interface AudioExtractionOptions {
  maxDuration?: number; // Maximum duration in seconds (to prevent abuse)
  format?: 'mp3' | 'wav';
  sampleRate?: number;
}

/**
 * Extract audio from YouTube video
 * @param videoId YouTube video ID
 * @param options Extraction options
 * @returns Path to extracted audio file
 */
export async function extractAudioFromYouTube(
  videoId: string,
  options: AudioExtractionOptions = {}
): Promise<string> {
  const {
    maxDuration = 7200, // 2 hours max
    format = 'mp3',
    sampleRate = 16000,
  } = options;

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Create temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `audio_${videoId}_${Date.now()}.${format}`);

  try {
    // Get video info to check duration
    const info = await ytdl.getInfo(url);
    const duration = parseInt(info.videoDetails.lengthSeconds);

    if (duration > maxDuration) {
      throw new Error(`Video is too long (${duration}s). Maximum allowed: ${maxDuration}s`);
    }

    // Download audio stream
    const audioStream = ytdl(url, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    // Convert to desired format using ffmpeg
    const ffmpeg = await getFfmpeg();
    
    return new Promise((resolve, reject) => {
      ffmpeg(audioStream)
        .audioBitrate(128)
        .audioFrequency(sampleRate)
        .format(format)
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(new Error(`Audio extraction failed: ${err.message}`));
        })
        .on('end', () => {
          resolve(outputPath);
        })
        .save(outputPath);
    });
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    throw error;
  }
}

/**
 * Extract audio from uploaded video file
 * @param inputPath Path to input video file
 * @param options Extraction options
 * @returns Path to extracted audio file
 */
export async function extractAudioFromFile(
  inputPath: string,
  options: AudioExtractionOptions = {}
): Promise<string> {
  const {
    maxDuration = 7200, // 2 hours max
    format = 'mp3',
    sampleRate = 16000,
  } = options;

  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(
    tempDir,
    `audio_${path.basename(inputPath, path.extname(inputPath))}_${Date.now()}.${format}`
  );

  const ffmpeg = await getFfmpeg();
  
  return new Promise((resolve, reject) => {
    // First, get video metadata to check duration
    ffmpeg.ffprobe(inputPath, (err: any, metadata: any) => {
      if (err) {
        reject(new Error(`Failed to read video metadata: ${err.message}`));
        return;
      }

      const duration = metadata.format.duration || 0;
      if (duration > maxDuration) {
        reject(new Error(`Video is too long (${duration}s). Maximum allowed: ${maxDuration}s`));
        return;
      }

      // Extract audio
      ffmpeg(inputPath)
        .audioBitrate(128)
        .audioFrequency(sampleRate)
        .format(format)
        .on('error', (err: any) => {
          console.error('FFmpeg error:', err);
          // Clean up on error
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          reject(new Error(`Audio extraction failed: ${err.message}`));
        })
        .on('end', () => {
          resolve(outputPath);
        })
        .save(outputPath);
    });
  });
}

/**
 * Clean up temporary audio file
 * @param audioPath Path to audio file to delete
 */
export function cleanupAudioFile(audioPath: string): void {
  try {
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
  } catch (error) {
    console.error('Failed to cleanup audio file:', error);
  }
}

/**
 * Clean up old temporary files (older than 1 hour)
 */
export function cleanupOldTempFiles(): void {
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    return;
  }

  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  try {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old temp files:', error);
  }
}
