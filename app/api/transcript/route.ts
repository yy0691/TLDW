import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId } from '@/lib/utils';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { getSubtitlesWithYtDlp, isYtDlpAvailable } from '@/lib/ytdlp-client';

async function handler(request: NextRequest) {
  try {
    const { url, autoFallback = true } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    let transcriptSegments: any[] | null = null;
    try {
      const response = await fetch(`https://api.supadata.ai/v1/youtube/transcript?url=https://www.youtube.com/watch?v=${videoId}`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      const responseText = await response.text();
      let parsedBody: Record<string, unknown> | null = null;

      if (responseText) {
        try {
          parsedBody = JSON.parse(responseText);
        } catch {
          parsedBody = null;
        }
      }

      const combinedErrorFields = [
        typeof parsedBody?.error === 'string' ? parsedBody.error : null,
        typeof parsedBody?.message === 'string' ? parsedBody.message : null,
        typeof parsedBody?.details === 'string' ? parsedBody.details : null,
        responseText || null
      ].filter(Boolean) as string[];

      const combinedErrorMessage = combinedErrorFields.join(' ').toLowerCase();
      const hasSupadataError =
        typeof parsedBody?.error === 'string' &&
        parsedBody.error.trim().length > 0;

      const supadataStatusMessage =
        typeof parsedBody?.message === 'string' && parsedBody.message.trim().length > 0
          ? parsedBody.message.trim()
          : 'Transcript Unavailable';

      const supadataDetails =
        typeof parsedBody?.details === 'string' && parsedBody.details.trim().length > 0
          ? parsedBody.details.trim()
          : 'No transcript is available for this video.';

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json(
            { error: 'No transcript/captions available for this video. The video may not have subtitles enabled.' },
            { status: 404 }
          );
        }

        throw new Error(
          `Supadata transcript request failed (${response.status})${combinedErrorFields.length > 0 ? `: ${combinedErrorFields.join(' ')}` : ''}`
        );
      }

      if (response.status === 206 || hasSupadataError) {
        return NextResponse.json(
          {
            error: supadataStatusMessage,
            details: supadataDetails
          },
          { status: 404 }
        );
      }

      const candidateContent = Array.isArray(parsedBody?.content)
        ? parsedBody?.content
        : Array.isArray(parsedBody?.transcript)
          ? parsedBody?.transcript
          : Array.isArray(parsedBody)
            ? parsedBody
            : null;

      if (!candidateContent || candidateContent.length === 0) {
        return NextResponse.json(
          {
            error: supadataStatusMessage,
            details: supadataDetails
          },
          { status: 404 }
        );
      }

      transcriptSegments = candidateContent;
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : '';
      
      // If transcript fetch failed and auto-fallback is enabled, try yt-dlp
      if (autoFallback && await isYtDlpAvailable()) {
        console.log(`[Transcript] Supadata failed, attempting yt-dlp fallback for video: ${videoId}`);
        
        try {
          // Use yt-dlp to extract subtitles (supports YouTube, Bilibili, etc.)
          const ytdlpTranscript = await getSubtitlesWithYtDlp(url);
          
          console.log(`[Transcript] yt-dlp fallback successful: ${ytdlpTranscript.length} segments`);
          
          return NextResponse.json({
            videoId,
            transcript: ytdlpTranscript,
            source: 'ytdlp',
            fallback: true,
          });
        } catch (ytdlpError) {
          console.error('[Transcript] yt-dlp fallback also failed:', ytdlpError);
          // Continue to original error handling
        }
      }
      
      if (errorMessage.includes('404')) {
        return NextResponse.json(
          { 
            error: 'No transcript/captions available for this video. The video may not have subtitles enabled.',
            canAutoGenerate: await isYtDlpAvailable(),
          },
          { status: 404 }
        );
      }
      throw fetchError;
    }
    
    if (!transcriptSegments || transcriptSegments.length === 0) {
      // If no transcript found and auto-fallback is enabled, try yt-dlp
      if (autoFallback && await isYtDlpAvailable()) {
        console.log(`[Transcript] No segments found, attempting yt-dlp fallback for video: ${videoId}`);
        
        try {
          // Use yt-dlp to extract subtitles
          const ytdlpTranscript = await getSubtitlesWithYtDlp(url);
          
          console.log(`[Transcript] yt-dlp fallback successful: ${ytdlpTranscript.length} segments`);
          
          return NextResponse.json({
            videoId,
            transcript: ytdlpTranscript,
            source: 'ytdlp',
            fallback: true,
          });
        } catch (ytdlpError) {
          console.error('[Transcript] yt-dlp fallback also failed:', ytdlpError);
          // Continue to original error handling
        }
      }
      
      return NextResponse.json(
        { 
          error: 'No transcript available for this video',
          canAutoGenerate: await isYtDlpAvailable(),
        },
        { status: 404 }
      );
    }

    const transformedTranscript = Array.isArray(transcriptSegments) ? transcriptSegments.map((item, idx) => {
      const transformed = {
        text: item.text || item.content || '',
        // Convert milliseconds to seconds for offset/start
        start: (item.offset !== undefined ? item.offset / 1000 : item.start) || 0,
        // Convert milliseconds to seconds for duration
        duration: (item.duration !== undefined ? item.duration / 1000 : 0) || 0
      };
      
      // Check for empty segments
      if (!transformed.text || transformed.text.trim() === '') {
      }
      
      // Debug segments around index 40-46
      if (idx >= 40 && idx <= 46) {
      }
      
      return transformed;
    }) : [];
    

    return NextResponse.json({
      videoId,
      transcript: transformedTranscript
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);
