import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';

async function handler(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          error: 'Supabase configuration missing',
          details: 'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in your environment before uploading local videos.'
        },
        { status: 503 }
      );
    }

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
    const videosBucket = process.env.NEXT_PUBLIC_SUPABASE_VIDEOS_BUCKET ?? 'videos';

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(videosBucket)
      .upload(fileName, videoFile, {
        contentType: videoFile.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      const errorMessage = uploadError.message || 'Failed to upload video';
      return NextResponse.json(
        {
          error: 'Failed to upload video',
          details: errorMessage,
          hint: `Ensure the Supabase storage bucket "${videosBucket}" exists and your service role has access.`
        },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from(videosBucket)
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

// Configure route to accept large file uploads (500MB)
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes timeout

export const POST = withSecurity(handler, {
  ...SECURITY_PRESETS.PUBLIC,
  maxBodySize: 500 * 1024 * 1024, // 500MB for video uploads
});
