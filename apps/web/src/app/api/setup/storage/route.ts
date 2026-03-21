import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKETS = [
  { name: 'recordings', public: true },
  { name: 'screenshots', public: true },
  { name: 'brand-assets', public: true },
];

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results: Array<{ bucket: string; status: string }> = [];

  for (const bucket of BUCKETS) {
    const { data: existing } = await supabase.storage.getBucket(bucket.name);
    if (existing) {
      results.push({ bucket: bucket.name, status: 'already exists' });
      continue;
    }

    const { error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.name === 'recordings' ? 500 * 1024 * 1024 : 50 * 1024 * 1024,
    });

    results.push({
      bucket: bucket.name,
      status: error ? `error: ${error.message}` : 'created',
    });
  }

  return NextResponse.json({ buckets: results });
}
