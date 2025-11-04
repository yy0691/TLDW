try {
  require('dotenv').config({ path: '.env.local' });
} catch (err) {
  // dotenv is optional; ignore if not installed
}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const objectPath = `test-uploads/${Date.now()}-hello.txt`;
  const fileContents = Buffer.from(`Hello from Supabase upload test at ${new Date().toISOString()}\n`, 'utf-8');

  const { data, error } = await supabase.storage
    .from('videos')
    .upload(objectPath, fileContents, {
      contentType: 'text/plain',
      upsert: false,
    });

  if (error) {
    console.error('Upload failed:', error);
  } else {
    console.log('Upload succeeded:', data);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
