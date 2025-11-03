import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';

async function postHandler(
  request: NextRequest
) {
  try {
    // Extract collectionId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const collectionId = pathParts[pathParts.indexOf('collections') + 1];
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { videoAnalysisId } = await request.json();

    if (!videoAnalysisId) {
      return NextResponse.json(
        { error: 'Video analysis ID is required' },
        { status: 400 }
      );
    }

    // Verify collection belongs to user
    const { data: collection, error: collectionError } = await supabase
      .from('video_collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Check if video already in collection
    const { data: existing } = await supabase
      .from('collection_videos')
      .select('id')
      .eq('collection_id', collectionId)
      .eq('video_analysis_id', videoAnalysisId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Video already in collection' },
        { status: 400 }
      );
    }

    // Get current max order
    const { data: maxOrderData } = await supabase
      .from('collection_videos')
      .select('order')
      .eq('collection_id', collectionId)
      .order('order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.order || 0) + 1;

    // Add video to collection
    const { data: collectionVideo, error: addError } = await supabase
      .from('collection_videos')
      .insert({
        collection_id: collectionId,
        video_analysis_id: videoAnalysisId,
        order: nextOrder
      })
      .select()
      .single();

    if (addError) {
      console.error('Add video to collection error:', addError);
      return NextResponse.json(
        { error: 'Failed to add video to collection' },
        { status: 500 }
      );
    }

    // Update collection video count
    const { error: updateError } = await supabase.rpc('increment_collection_video_count', {
      collection_id: collectionId
    });

    if (updateError) {
      console.error('Update video count error:', updateError);
    }

    return NextResponse.json({ collectionVideo });
  } catch (error) {
    console.error('Add video to collection error:', error);
    return NextResponse.json(
      { error: 'Failed to add video to collection' },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  request: NextRequest
) {
  try {
    // Extract collectionId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const collectionId = pathParts[pathParts.indexOf('collections') + 1];
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { videoAnalysisId } = await request.json();

    if (!videoAnalysisId) {
      return NextResponse.json(
        { error: 'Video analysis ID is required' },
        { status: 400 }
      );
    }

    // Verify collection belongs to user
    const { data: collection, error: collectionError } = await supabase
      .from('video_collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Remove video from collection
    const { error: deleteError } = await supabase
      .from('collection_videos')
      .delete()
      .eq('collection_id', collectionId)
      .eq('video_analysis_id', videoAnalysisId);

    if (deleteError) {
      console.error('Remove video from collection error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove video from collection' },
        { status: 500 }
      );
    }

    // Update collection video count
    const { error: updateError } = await supabase.rpc('decrement_collection_video_count', {
      collection_id: collectionId
    });

    if (updateError) {
      console.error('Update video count error:', updateError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove video from collection error:', error);
    return NextResponse.json(
      { error: 'Failed to remove video from collection' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(postHandler, SECURITY_PRESETS.AUTHENTICATED);
export const DELETE = withSecurity(deleteHandler, SECURITY_PRESETS.AUTHENTICATED);
