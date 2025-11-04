import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractVideoId } from '@/lib/utils';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';

async function handler(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, videoId: rawVideoId } = (body ?? {}) as { url?: string; videoId?: string };

    // Determine videoId from either url (YouTube) or explicit local/youtube id
    let videoId: string | null = null;
    if (typeof url === 'string' && url.trim().length > 0) {
      videoId = extractVideoId(url);
    }
    if (!videoId && typeof rawVideoId === 'string' && rawVideoId.trim().length > 0) {
      videoId = rawVideoId.trim();
    }
    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId or url is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();

    // Check for cached video (works for both YouTube and local IDs)
    const { data: cachedVideo } = await supabase
      .from('video_analyses')
      .select('*')
      .eq('youtube_id', videoId)
      .single();

    if (cachedVideo && cachedVideo.topics) {
      // If user is logged in, track their access to this video
      if (user) {
        await supabase
          .from('user_videos')
          .upsert({
            user_id: user.id,
            video_id: cachedVideo.id,
            accessed_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,video_id'
          });
      }

      // Return all cached data including transcript and video info
      return NextResponse.json({
        cached: true,
        videoId: videoId,
        topics: cachedVideo.topics,
        transcript: cachedVideo.transcript,
        videoInfo: {
          title: cachedVideo.title,
          author: cachedVideo.author,
          duration: cachedVideo.duration,
          thumbnail: cachedVideo.thumbnail_url
        },
        summary: cachedVideo.summary,
        suggestedQuestions: cachedVideo.suggested_questions,
        cacheDate: cachedVideo.created_at
      });
    }

    // Video not cached
    return NextResponse.json({
      cached: false,
      videoId: videoId
    });

  } catch (error) {
    console.error('Error checking video cache:', error);
    return NextResponse.json(
      { error: 'Failed to check video cache' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);