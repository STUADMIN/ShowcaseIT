/** STUN + optional TURN (set NEXT_PUBLIC_TURN_* for strict NATs / different networks). */
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl?.trim()) {
    servers.push({
      urls: turnUrl.trim(),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? '',
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? '',
    });
  }

  return servers;
}
