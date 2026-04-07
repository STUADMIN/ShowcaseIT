import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { getResolvedFfmpegPath } from '@/lib/video/ffmpeg-resolve';

const execFileAsync = promisify(execFile);

export async function GET() {
  const pathToBin = getResolvedFfmpegPath();
  const exists = pathToBin !== 'ffmpeg' && fs.existsSync(pathToBin);

  let version: string | null = null;
  if (exists || pathToBin === 'ffmpeg') {
    try {
      const { stdout } = await execFileAsync(pathToBin, ['-version'], { timeout: 10000 });
      version = stdout.split('\n')[0] || stdout.slice(0, 120);
    } catch {
      version = null;
    }
  }

  return NextResponse.json({
    ok: Boolean(version),
    path: pathToBin,
    existsOnDisk: exists,
    versionLine: version,
    cwd: process.cwd(),
  });
}
