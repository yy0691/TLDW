import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { TranscriptSegment } from './types';

/**
 * Whisper client for automatic speech recognition
 * Converts audio to text with timestamps
 */
export class WhisperClient {
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key is required for speech recognition');
    }
    this.client = new OpenAI({ apiKey: key });
  }

  /**
   * Transcribe audio file to text with timestamps
   * @param audioPath Path to audio file (mp3, mp4, wav, etc.)
   * @param language Optional language code (e.g., 'en', 'zh')
   * @returns Array of transcript segments with timestamps
   */
  async transcribe(
    audioPath: string,
    language?: string
  ): Promise<TranscriptSegment[]> {
    try {
      const audioFile = fs.createReadStream(audioPath);
      
      // Use Whisper API with verbose_json response format to get timestamps
      const response = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: language,
        timestamp_granularities: ['segment'],
      });

      // Convert Whisper segments to our TranscriptSegment format
      const segments: TranscriptSegment[] = [];
      
      if ('segments' in response && Array.isArray(response.segments)) {
        for (const segment of response.segments) {
          segments.push({
            text: segment.text.trim(),
            start: segment.start,
            duration: segment.end - segment.start,
          });
        }
      } else if ('text' in response) {
        // Fallback: if no segments, create one segment for entire text
        segments.push({
          text: response.text,
          start: 0,
          duration: 0,
        });
      }

      return segments;
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio from file buffer
   * @param buffer Audio file buffer
   * @param filename Original filename (for format detection)
   * @param language Optional language code
   * @returns Array of transcript segments
   */
  async transcribeBuffer(
    buffer: Buffer,
    filename: string,
    language?: string
  ): Promise<TranscriptSegment[]> {
    // Create temporary file
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `temp_${Date.now()}_${filename}`);
    
    try {
      // Write buffer to temp file
      fs.writeFileSync(tempPath, buffer);
      
      // Transcribe the temp file
      const segments = await this.transcribe(tempPath, language);
      
      return segments;
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }
}

/**
 * Create a singleton instance of WhisperClient
 */
let whisperInstance: WhisperClient | null = null;

export function getWhisperClient(): WhisperClient {
  if (!whisperInstance) {
    whisperInstance = new WhisperClient();
  }
  return whisperInstance;
}
