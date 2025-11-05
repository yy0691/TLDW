import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptApiKey, getApiKeyPreview } from '@/lib/api-key-encryption';

// GET - Fetch user's API keys (masked)
export async function GET() {
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
      .select('id, provider, provider_name, api_key_preview, base_url, model_name, is_active, created_at, updated_at')
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
    const { provider, apiKey, baseUrl, modelName, providerName } = body;
    
    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }
    
    // Validate provider string
    if (typeof provider !== 'string' || provider.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid provider format' },
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
    
    // For custom providers, require baseUrl and modelName
    if (provider === 'custom' && (!baseUrl || !modelName)) {
      return NextResponse.json(
        { error: 'Custom providers require baseUrl and modelName' },
        { status: 400 }
      );
    }
    
    const encryptedKey = encryptApiKey(apiKey);
    const preview = getApiKeyPreview(apiKey);
    
    const upsertData: any = {
      user_id: user.id,
      provider,
      api_key_encrypted: encryptedKey,
      api_key_preview: preview,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    
    // Add optional fields for custom providers
    if (baseUrl) {
      upsertData.base_url = baseUrl;
    }
    if (modelName) {
      upsertData.model_name = modelName;
    }
    if (providerName) {
      upsertData.provider_name = providerName;
    }
    
    const { data, error } = await supabase
      .from('user_api_keys')
      .upsert(upsertData, {
        onConflict: 'user_id,provider',
      })
      .select('id, provider, provider_name, api_key_preview, base_url, model_name, is_active, created_at, updated_at')
      .single();
    
    if (error) {
      console.error('Error saving API key:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to save API key';
      if (error.message?.includes('constraint') || error.message?.includes('check')) {
        errorMessage = 'Database constraint error. Please ensure the migrations have been run. Check the console for details.';
      } else if (error.code === '23505') {
        errorMessage = 'An API key for this provider already exists';
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: error.message 
        },
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
