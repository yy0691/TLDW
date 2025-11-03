import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';

async function handler(request: NextRequest) {
  try {
    const supabase = await createClient();
    // 登录认证
    // Check authentication (commented out for local testing)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // if (authError || !user) {
    //   return NextResponse.json(
    //     { error: 'Authentication required' },
    //     { status: 401 }
    //   );
    // }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const title = formData.get('title') as string;
    const author = formData.get('author') as string || 'Local Upload';

    if (!videoFile) {
      return NextResponse.json(
        { error: 'Video file is required' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Video title is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validVideoTypes.includes(videoFile.type)) {
      return NextResponse.json(
        { error: 'Invalid video format. Supported: MP4, WebM, OGG, MOV' },
        { status: 400 }
      );
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (videoFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Video file too large. Maximum size: 500MB' },
        { status: 400 }
      );
    }

    // Generate unique video ID
    const videoId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userId = user?.id || 'anonymous';
    const fileName = `${userId}/${videoId}/${videoFile.name}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('videos')
      .upload(fileName, videoFile, {
        contentType: videoFile.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload video' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('videos')
      .getPublicUrl(fileName);

    // Get video duration (we'll need this from the client side)
    const duration = parseInt(formData.get('duration') as string) || null;

    return NextResponse.json({
      videoId,
      title,
      author,
      url: publicUrl,
      duration,
      source: 'local'
    });
  } catch (error) {
    console.error('Upload video error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED);
