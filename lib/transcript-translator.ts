import { TranscriptSegment, TranscriptLanguage } from './types';
import { fetchWithCSRF } from './csrf-client';

export interface TranslateTranscriptOptions {
  transcript: TranscriptSegment[];
  targetLanguage: TranscriptLanguage;
  sourceLanguage?: TranscriptLanguage | 'auto';
  signal?: AbortSignal;
}

export interface TranslateTranscriptResponse {
  transcript: TranscriptSegment[];
  sourceLanguage: string;
  targetLanguage: TranscriptLanguage;
  segmentCount: number;
}

/**
 * Translate transcript segments to target language
 */
export async function translateTranscript({
  transcript,
  targetLanguage,
  sourceLanguage = 'auto',
  signal,
}: TranslateTranscriptOptions): Promise<TranslateTranscriptResponse> {
  const response = await fetchWithCSRF('/api/translate-transcript', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transcript,
      targetLanguage,
      sourceLanguage,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to translate transcript');
  }

  return response.json();
}

/**
 * Detect the primary language of a transcript
 * Returns a guess based on character analysis
 */
export function detectTranscriptLanguage(transcript: TranscriptSegment[]): TranscriptLanguage {
  if (!transcript || transcript.length === 0) {
    return 'original';
  }

  // Sample first few segments
  const sampleText = transcript
    .slice(0, Math.min(10, transcript.length))
    .map(seg => seg.text)
    .join(' ');

  // Count different character types
  const chineseChars = (sampleText.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinChars = (sampleText.match(/[a-zA-Z]/g) || []).length;
  
  // Check for Traditional Chinese specific characters
  const traditionalChars = (sampleText.match(/[繁體簡]/g) || []).length;

  // Determine language based on character distribution
  if (chineseChars > latinChars * 2) {
    // Mostly Chinese
    if (traditionalChars > 0) {
      return 'zh-TW';
    }
    return 'zh-CN';
  } else if (latinChars > chineseChars * 2) {
    // Mostly English
    return 'en';
  }

  return 'original';
}

/**
 * Restore original text for all segments
 */
export function restoreOriginalTranscript(transcript: TranscriptSegment[]): TranscriptSegment[] {
  return transcript.map(segment => ({
    ...segment,
    text: segment.originalText || segment.text,
    language: 'original' as TranscriptLanguage,
  }));
}
