import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

/** PNG generation uses Node APIs — avoid Edge where `qrcode` can fail. */
export const runtime = 'nodejs';

/** Only allow QR payloads that point at our own “cast from phone” URLs (path + session UUID). */
const CAST_PATH =
  /^\/cast\/s\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Use the Host header first. In dev, proxies often set `x-forwarded-host` to `localhost` (no port)
 * while the page URL is `localhost:3000` — comparing against forwarded breaks QR images (403 → broken <img>).
 */
function requestHost(request: NextRequest): string | null {
  const host = request.headers.get('host');
  if (host) return host.trim();
  const forwarded = request.headers.get('x-forwarded-host');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }
  return null;
}

/** Allow localhost ↔ 127.0.0.1 when the port matches (common dev mismatch). */
function hostAllowed(targetHost: string, requestHostHeader: string | null): boolean {
  if (!requestHostHeader) return false;
  if (targetHost === requestHostHeader) return true;

  const parse = (h: string) => {
    const m = /^(.+):(\d+)$/.exec(h);
    if (!m) return { hostname: h.toLowerCase(), port: '' };
    return { hostname: m[1].toLowerCase(), port: m[2] };
  };

  const t = parse(targetHost);
  const r = parse(requestHostHeader);
  const canon = (host: string) =>
    host === '127.0.0.1' ? 'localhost' : host;

  return canon(t.hostname) === canon(r.hostname) && t.port === r.port;
}

/** LAN / local hosts used when dev QR encodes http://192.168.x.x:3000 but the image request hits localhost. */
function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  const m = /^172\.(\d{1,3})\./.exec(h);
  if (m) {
    const n = Number(m[1]);
    return n >= 16 && n <= 31;
  }
  return false;
}

/**
 * Allow QR PNG when the encoded URL host differs from the request host in dev (LAN URL + localhost tab),
 * or when extra hosts are configured for staging.
 */
function qrUrlHostAllowed(target: URL, request: NextRequest): boolean {
  const reqHost = requestHost(request);
  if (!reqHost) return false;

  if (!CAST_PATH.test(target.pathname)) return false;

  if (hostAllowed(target.host, reqHost)) return true;

  if (process.env.NODE_ENV === 'development' && isPrivateOrLocalHostname(target.hostname)) {
    return true;
  }

  const extra =
    process.env.CAST_QR_ALLOWED_HOSTS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  if (extra.includes(target.host)) return true;

  return false;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw || raw.length > 2048) {
    return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  const host = requestHost(request);
  if (!host || !qrUrlHostAllowed(target, request)) {
    return NextResponse.json({ error: 'URL host mismatch' }, { status: 403 });
  }

  try {
    const buffer = await QRCode.toBuffer(target.toString(), {
      type: 'png',
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    // `Buffer` is a Node type; DOM `BodyInit` typings don't include it — `Uint8Array` is accepted everywhere.
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 });
  }
}
