import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { TranscriptSegment } from './types';

const execAsync = promisify(exec);

interface YtDlpSubtitle {
  text: string;
  start: number;
  duration: number;
}

export class SubtitlesNotFoundError extends Error {
  constructor(message = 'No subtitles available for this video') {
    super(message);
    this.name = 'SubtitlesNotFoundError';
  }
}

/**
 * Check if yt-dlp is installed
 */
export async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await execAsync('yt-dlp --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get subtitles using yt-dlp
 * Supports YouTube, Bilibili, and many other platforms
 */
export async function getSubtitlesWithYtDlp(
  videoUrl: string,
  preferredLanguages: string[] = ['zh-Hans', 'zh-CN', 'zh', 'en']
): Promise<TranscriptSegment[]> {
  const tempDir = path.join(process.cwd(), 'temp', 'ytdlp');
  const timestamp = Date.now();
  const outputTemplate = path.join(tempDir, `subtitle_${timestamp}`);

  try {
    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    // Build language preference string
    const langString = preferredLanguages.join(',');

    // Download subtitles using yt-dlp
    // --write-auto-sub: Download auto-generated subtitles if available
    // --sub-lang: Preferred subtitle languages
    // --sub-format: json3 format provides structured data with timestamps
    // --skip-download: Don't download the video, only subtitles
    const command = `yt-dlp --write-auto-sub --write-sub --sub-lang "${langString}" --sub-format json3 --skip-download -o "${outputTemplate}" "${videoUrl}"`;

    console.log('[yt-dlp] Executing:', command);
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60 second timeout
    });

    if (stderr) {
      console.log('[yt-dlp] stderr:', stderr);
    }

    // Find the generated subtitle file
    const files = await fs.readdir(tempDir);
    const subtitleFile = files.find(
      (file) => file.startsWith(`subtitle_${timestamp}`) && file.endsWith('.json3')
    );

    if (!subtitleFile) {
      throw new SubtitlesNotFoundError();
    }

    const subtitlePath = path.join(tempDir, subtitleFile);
    const content = await fs.readFile(subtitlePath, 'utf-8');

    // Parse json3 format
    const lines = content.trim().split('\n');
    const segments: TranscriptSegment[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line) as YtDlpSubtitle;
        
        // Filter out empty segments
        if (data.text && data.text.trim()) {
          segments.push({
            text: data.text.trim(),
            start: data.start,
            duration: data.duration || 0,
          });
        }
      } catch (parseError) {
        console.warn('[yt-dlp] Failed to parse line:', line);
      }
    }

    // Cleanup
    await cleanupGeneratedFiles(tempDir, timestamp).catch(() => {});

    if (segments.length === 0) {
      throw new SubtitlesNotFoundError();
    }

    console.log(`[yt-dlp] Successfully extracted ${segments.length} subtitle segments`);
    return segments;
  } catch (error) {
    console.error('[yt-dlp] Error:', error);
    throw error;
  } finally {
    await cleanupDirectoryIfEmpty(tempDir).catch(() => {});
  }
}

async function cleanupGeneratedFiles(directory: string, timestamp: number) {
  const files = await fs.readdir(directory).catch(() => [] as string[]);
  const prefix = `subtitle_${timestamp}`;

  await Promise.all(
    files
      .filter((file) => file.startsWith(prefix))
      .map((file) => fs.unlink(path.join(directory, file)).catch(() => {}))
  );
}

async function cleanupDirectoryIfEmpty(directory: string) {
  try {
    const files = await fs.readdir(directory);
    if (files.length === 0) {
      await fs.rmdir(directory);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Get video info using yt-dlp
 */
export async function getVideoInfoWithYtDlp(videoUrl: string): Promise<{
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  description?: string;
}> {
  try {
    const command = `yt-dlp --dump-json --skip-download "${videoUrl}"`;
    
    const { stdout } = await execAsync(command, {
      timeout: 30000,
    });

    const info = JSON.parse(stdout);

    return {
      title: info.title || 'Unknown Title',
      author: info.uploader || info.channel || 'Unknown Author',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || '',
      description: info.description || '',
    };
  } catch (error) {
    console.error('[yt-dlp] Failed to get video info:', error);
    throw error;
  }
}
