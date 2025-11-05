import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptApiKey, getApiKeyPreview } from '@/lib/api-key-encryption';

// GET - Fetch user's API keys (masked)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { data: apiKeys, error } = await supabase
      .from('user_api_keys')
      .select('id, provider, api_key_preview, is_active, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching API keys:', error);
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ apiKeys: apiKeys || [] });
    
  } catch (error) {
    console.error('Error in GET /api/user/api-keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Save/update user's API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { provider, apiKey } = body;
    
    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }
    
    if (!['google', 'openai'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "google" or "openai"' },
        { status: 400 }
      );
    }
    
    // Validate API key format
    if (typeof apiKey !== 'string' || apiKey.length < 10) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      );
    }
    
    const encryptedKey = encryptApiKey(apiKey);
    const preview = getApiKeyPreview(apiKey);
    
    const { data, error } = await supabase
      .from('user_api_keys')
      .upsert({
        user_id: user.id,
        provider,
        api_key_encrypted: encryptedKey,
        api_key_preview: preview,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      })
      .select('id, provider, api_key_preview, is_active, created_at, updated_at')
      .single();
    
    if (error) {
      console.error('Error saving API key:', error);
      return NextResponse.json(
        { error: 'Failed to save API key' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      apiKey: data,
    });
    
  } catch (error) {
    console.error('Error in POST /api/user/api-keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove user's API key
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    
    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);
    
    if (error) {
      console.error('Error deleting API key:', error);
      return NextResponse.json(
        { error: 'Failed to delete API key' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error in DELETE /api/user/api-keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
