# Auto Subtitle Recognition Feature

## Overview

This feature enables automatic subtitle/caption generation for videos that don't have existing subtitles. It uses OpenAI's Whisper API for high-quality speech-to-text transcription.

## Features

### 1. Automatic Fallback for YouTube Videos
- When a YouTube video doesn't have subtitles available, the system automatically:
  1. Extracts audio from the video
  2. Transcribes it using Whisper
  3. Returns the generated transcript

### 2. Local Video Upload with Auto-Transcription
- Users can upload local video files (MP4, WebM, OGG, MOV)
- Subtitle files (.srt, .vtt) are now **optional**
- If no subtitle is provided, the system automatically:
  1. Extracts audio from the uploaded video
  2. Transcribes it using Whisper
  3. Generates transcript segments with timestamps

### 3. Manual Subtitle Generation
- Direct API endpoint `/api/auto-subtitle` for generating subtitles
- Supports language specification (defaults to auto-detect)

## Setup

### Environment Variables

Add the following to your `.env.local`:

```bash
# Required for automatic subtitle generation
OPENAI_API_KEY=your_openai_api_key_here

# Existing keys
GEMINI_API_KEY=your_gemini_api_key
SUPADATA_API_KEY=your_supadata_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Dependencies

The following packages have been added:
- `openai` - OpenAI API client for Whisper
- `ytdl-core` - YouTube video/audio download
- `fluent-ffmpeg` - Audio extraction and processing
- `@ffmpeg-installer/ffmpeg` - FFmpeg binary

Install them with:
```bash
npm install
```

## API Endpoints

### POST /api/transcript
Enhanced existing endpoint with automatic fallback.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "autoFallback": true  // Optional, defaults to true
}
```

**Response (with fallback):**
```json
{
  "videoId": "VIDEO_ID",
  "transcript": [...],
  "source": "whisper",
  "fallback": true
}
```

### POST /api/auto-subtitle
Generate subtitles for YouTube videos without existing captions.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "language": "en"  // Optional
}
```

**Response:**
```json
{
  "videoId": "VIDEO_ID",
  "transcript": [
    {
      "text": "Hello world",
      "start": 0.5,
      "duration": 1.2
    }
  ],
  "source": "whisper",
  "language": "en"
}
```

### POST /api/upload-video
Upload and transcribe local video files.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `video`: Video file (required)
  - `language`: Language code (optional, defaults to auto-detect)

**Response:**
```json
{
  "videoId": "local_1234567890",
  "title": "video_filename",
  "duration": 120,
  "transcript": [...],
  "source": "local",
  "language": "en"
}
```

## Usage

### Frontend Integration

#### Local Video Upload Component

```tsx
import { LocalVideoUpload } from '@/components/local-video-upload';

<LocalVideoUpload 
  onUploadComplete={(videoId, transcript) => {
    // Handle upload completion
    router.push(`/analyze/${videoId}`);
  }}
/>
```

The subtitle file is now optional. If not provided, the system will automatically generate subtitles.

### Processing Flow

#### YouTube Videos (with fallback)
```
1. Fetch transcript from Supadata
   ↓ (if fails)
2. Extract audio using ytdl-core
   ↓
3. Transcode to MP3 using FFmpeg
   ↓
4. Send to Whisper API
   ↓
5. Return generated transcript
```

#### Local Video Upload
```
1. User uploads video file (subtitle optional)
   ↓
2. Extract audio using FFmpeg
   ↓
3. Send to Whisper API
   ↓
4. Return generated transcript
```

## Limitations

### File Constraints
- **Maximum video duration:** 2 hours (7200 seconds)
- **Maximum file size:** 500MB for uploads
- **Supported formats:** MP4, WebM, OGG, MOV

### Cost Considerations
- Whisper API charges $0.006 per minute of audio
- A 1-hour video costs approximately $0.36 to transcribe
- Consider implementing usage limits for production

### Performance
- Audio extraction: ~10-30 seconds (depends on video length)
- Whisper transcription: ~1-3 minutes for a 1-hour video
- Total processing time: typically 2-4 minutes for hour-long content

## Error Handling

The system handles various error scenarios:

1. **Video too long:** Returns 400 with clear message
2. **Video unavailable:** Returns 404 for private/deleted videos
3. **API key missing:** Returns 503 with configuration guidance
4. **OpenAI API errors:** Proper error propagation with details

## Cleanup

Temporary files are automatically cleaned up:
- Audio files deleted immediately after transcription
- Old temp files (>1 hour) cleaned on each new request
- Temporary directory: `/tmp` in project root

## Security

- Rate limiting applied via existing security middleware
- Maximum file size enforced (500MB)
- Temporary file cleanup prevents disk space issues
- All uploads validated for file type and size

## Future Enhancements

Potential improvements:
1. Support for more languages (Whisper supports 50+ languages)
2. Quality selection (speed vs accuracy tradeoffs)
3. Progress tracking for long transcriptions
4. Caching of generated transcripts
5. Batch processing for multiple videos
6. Alternative providers (Google Speech-to-Text, Azure, etc.)

## Troubleshooting

### "OpenAI API key is missing"
- Ensure `OPENAI_API_KEY` is set in `.env.local`
- Restart the development server after adding the key

### "FFmpeg not found"
- The `@ffmpeg-installer/ffmpeg` package should auto-install
- If issues persist, install FFmpeg system-wide

### Slow transcription
- Whisper processing is CPU-intensive on OpenAI's side
- Typical processing time: 2-4 minutes for 1-hour video
- Consider showing progress indicators to users

### Out of disk space
- Check the `/tmp` directory for stale files
- Old files should auto-cleanup after 1 hour
- Manually clear with: `rm -rf /home/engine/project/tmp/*`

## References

- [OpenAI Whisper API Documentation](https://platform.openai.com/docs/guides/speech-to-text)
- [ytdl-core Documentation](https://github.com/fent/node-ytdl-core)
- [fluent-ffmpeg Documentation](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
