import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

export const isWin = process.platform === 'win32';

const FFMPEG_EXE = isWin ? 'ffmpeg.exe' : 'ffmpeg';

function collectWalkRoots(): string[] {
  const roots = new Set<string>();
  const add = (p: string) => {
    try {
      roots.add(path.resolve(p));
    } catch {
      /* ignore */
    }
  };

  add(process.cwd());
  add(path.join(process.cwd(), 'apps', 'web'));

  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    let dir = here;
    for (let i = 0; i < 24; i++) {
      add(dir);
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  } catch {
    /* ignore */
  }

  return [...roots];
}

function resolveFfmpegPath(): string | null {
  for (const root of collectWalkRoots()) {
    let dir = root;
    for (let depth = 0; depth < 22; depth++) {
      const candidate = path.join(dir, 'node_modules', 'ffmpeg-static', FFMPEG_EXE);
      if (fs.existsSync(candidate)) return candidate;
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}

let cachedFfmpeg: string | null | undefined;

export function findFfmpeg(): string {
  if (cachedFfmpeg === undefined) {
    cachedFfmpeg = resolveFfmpegPath();
  }
  if (cachedFfmpeg) return cachedFfmpeg;

  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const linksPath = path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe');
    if (fs.existsSync(linksPath)) return linksPath;
  }
  return 'ffmpeg';
}

/** For diagnostics / health checks and video pipelines that only need the binary path. */
export function getResolvedFfmpegPath(): string {
  return findFfmpeg();
}
