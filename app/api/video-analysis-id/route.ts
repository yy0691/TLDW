import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';

async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const youtubeId = searchParams.get('youtubeId');

    if (!youtubeId) {
      return NextResponse.json(
        { error: 'YouTube ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Unified query for both local and remote videos
    const { data: videoAnalysis, error } = await supabase
      .from('video_analyses')
      .select('id')
      .eq('youtube_id', youtubeId)
      .single();

    if (error || !videoAnalysis) {
      return NextResponse.json(
        { error: 'Video analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: videoAnalysis.id
    });

  } catch (error) {
    console.error('Error fetching video analysis ID:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video analysis ID' },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(handler, SECURITY_PRESETS.PUBLIC);
