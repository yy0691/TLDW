import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';

async function getHandler(
  request: NextRequest
) {
  try {
    // Extract collectionId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const collectionId = pathParts[pathParts.length - 1];
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch collection with videos
    const { data: collection, error: collectionError } = await supabase
      .from('video_collections')
      .select('*')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Fetch videos in collection
    const { data: collectionVideos, error: videosError } = await supabase
      .from('collection_videos')
      .select(`
        *,
        video:video_analyses(
          id,
          youtube_id,
          title,
          author,
          thumbnail_url,
          duration
        )
      `)
      .eq('collection_id', collectionId)
      .order('order', { ascending: true });

    if (videosError) {
      console.error('Fetch videos error:', videosError);
      return NextResponse.json(
        { error: 'Failed to fetch collection videos' },
        { status: 500 }
      );
    }

    // Transform data
    const videos = (collectionVideos || []).map(cv => ({
      ...cv.video,
      order: cv.order,
      addedAt: cv.added_at
    }));

    return NextResponse.json({
      ...collection,
      videos
    });
  } catch (error) {
    console.error('Get collection error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection' },
      { status: 500 }
    );
  }
}

async function patchHandler(
  request: NextRequest
) {
  try {
    // Extract collectionId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const collectionId = pathParts[pathParts.length - 1];
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { title, description, thumbnail } = await request.json();

    // Update collection
    const { data: collection, error } = await supabase
      .from('video_collections')
      .update({
        title: title?.trim(),
        description: description?.trim() || null,
        thumbnail: thumbnail || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Update collection error:', error);
      return NextResponse.json(
        { error: 'Failed to update collection' },
        { status: 500 }
      );
    }

    return NextResponse.json({ collection });
  } catch (error) {
    console.error('Update collection error:', error);
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, SECURITY_PRESETS.AUTHENTICATED);
export const PATCH = withSecurity(patchHandler, SECURITY_PRESETS.AUTHENTICATED);
