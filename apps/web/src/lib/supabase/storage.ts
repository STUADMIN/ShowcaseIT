import { createClient } from './client';

const RECORDING_BUCKET = 'recordings';
const SCREENSHOT_BUCKET = 'screenshots';
const BRAND_ASSETS_BUCKET = 'brand-assets';

export async function uploadRecording(
  file: File | Blob,
  projectId: string,
  recordingId: string
): Promise<string> {
  const supabase = createClient();
  const path = `${projectId}/${recordingId}/video.webm`;

  const { error } = await supabase.storage
    .from(RECORDING_BUCKET)
    .upload(path, file, { upsert: true, contentType: 'video/webm' });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(RECORDING_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadScreenshot(
  file: File | Blob,
  guideId: string,
  stepOrder: number,
  variant: 'original' | 'styled' = 'original'
): Promise<string> {
  const supabase = createClient();
  const ext = file instanceof File ? file.name.split('.').pop() : 'png';
  const path = `${guideId}/step-${stepOrder}-${variant}.${ext}`;

  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadBrandAsset(
  file: File,
  workspaceId: string,
  type: 'logo' | 'font'
): Promise<string> {
  const supabase = createClient();
  const path = `${workspaceId}/${type}/${file.name}`;

  const { error } = await supabase.storage
    .from(BRAND_ASSETS_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BRAND_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function getPublicUrl(bucket: string, path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
