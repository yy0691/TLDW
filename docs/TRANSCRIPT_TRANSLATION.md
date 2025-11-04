# Transcript Translation Feature

## Overview

This feature allows users to translate video transcripts between different languages, with a focus on:
- **English to Simplified Chinese (en → zh-CN)**
- **Traditional Chinese to Simplified Chinese (zh-TW → zh-CN)**

## Architecture

### Components

1. **API Route** (`/api/translate-transcript`)
   - Handles translation requests
   - Uses Google Gemini AI for high-quality translations
   - Processes transcripts in batches of 50 segments
   - Returns translated segments with preserved timestamps

2. **Translation Client** (`lib/transcript-translator.ts`)
   - `translateTranscript()` - Main translation function
   - `detectTranscriptLanguage()` - Auto-detects source language
   - `restoreOriginalTranscript()` - Restores original text

3. **UI Component** (`components/transcript-viewer.tsx`)
   - Language dropdown menu in transcript header
   - Translation status indicator
   - "Translate to 简体中文" option
   - "Restore Original" option

### Data Model

```typescript
interface TranscriptSegment {
  text: string;              // Current text (original or translated)
  start: number;             // Timestamp in seconds
  duration: number;          // Duration in seconds
  originalText?: string;     // Original text (stored after translation)
  language?: TranscriptLanguage; // Current language
}

type TranscriptLanguage = 'en' | 'zh-CN' | 'zh-TW' | 'original';
```

## Usage

### For Users

1. **View Transcript**: Navigate to any video analysis page
2. **Open Translation Menu**: Click the language button in the transcript header
3. **Select Translation**: Choose "Translate to 简体中文"
4. **Wait**: Translation takes 30-60 seconds depending on transcript length
5. **Restore Original**: Click "Restore Original" to switch back

### For Developers

#### Translate a Transcript

```typescript
import { translateTranscript } from '@/lib/transcript-translator';

const result = await translateTranscript({
  transcript: myTranscript,
  targetLanguage: 'zh-CN',
  sourceLanguage: 'en', // or 'auto' for auto-detection
  signal: abortController.signal,
});

console.log(result.transcript); // Translated segments
```

#### Detect Language

```typescript
import { detectTranscriptLanguage } from '@/lib/transcript-translator';

const language = detectTranscriptLanguage(transcript);
// Returns: 'en', 'zh-CN', 'zh-TW', or 'original'
```

#### Restore Original

```typescript
import { restoreOriginalTranscript } from '@/lib/transcript-translator';

const restored = restoreOriginalTranscript(translatedTranscript);
// Returns transcript with original text
```

## Implementation Details

### Translation API

**Endpoint**: `POST /api/translate-transcript`

**Request Body**:
```json
{
  "transcript": [
    { "text": "Hello", "start": 0, "duration": 2 }
  ],
  "targetLanguage": "zh-CN",
  "sourceLanguage": "en"
}
```

**Response**:
```json
{
  "transcript": [
    {
      "text": "你好",
      "start": 0,
      "duration": 2,
      "originalText": "Hello",
      "language": "zh-CN"
    }
  ],
  "sourceLanguage": "en",
  "targetLanguage": "zh-CN",
  "segmentCount": 1
}
```

### Batch Processing

Transcripts are processed in batches of 50 segments to:
- Avoid token limits
- Provide better error handling
- Enable progress tracking

### Error Handling

- **Network Errors**: Gracefully handled with user notification
- **Partial Failures**: Individual batch failures don't stop entire translation
- **Abort Support**: Users can cancel ongoing translations
- **Timeout**: 60-second timeout per batch

### Caching

Translations can be cached in the database for future use:
- Stored in `video_analyses.transcript_zh_cn` column
- Indexed for fast retrieval
- Only cached after successful translation

## Database Schema

```sql
ALTER TABLE video_analyses
  ADD COLUMN transcript_zh_cn JSONB;

CREATE INDEX idx_video_analyses_transcript_zh_cn 
  ON video_analyses(id) 
  WHERE transcript_zh_cn IS NOT NULL;
```

## Performance

- **Translation Time**: ~30-60 seconds for typical video
- **Batch Size**: 50 segments per batch
- **Model**: Gemini 2.5 Flash (with fallback to Pro)
- **Token Usage**: ~1-2 tokens per character

## Future Enhancements

Potential improvements:
1. **More Languages**: Add support for other target languages
2. **Caching**: Automatically cache translations in database
3. **Parallel Batches**: Process multiple batches simultaneously
4. **Progress Bar**: Show translation progress percentage
5. **Quality Check**: Validate translation quality with confidence scores
6. **Bilingual View**: Show original and translated text side-by-side

## Troubleshooting

### Translation Takes Too Long

- Check network connection
- Verify Gemini API quota
- Reduce batch size if needed

### Translation Quality Issues

- Ensure source language is detected correctly
- Check transcript quality (auto-generated vs manual)
- Report specific issues for prompt improvement

### Missing Translations

- Verify API key is configured
- Check server logs for errors
- Ensure security middleware allows translation endpoint

## Security

- CSRF protection via `csrfFetch`
- Rate limiting applied (public preset)
- Input sanitization for transcript text
- Abort signal support to prevent hanging requests
