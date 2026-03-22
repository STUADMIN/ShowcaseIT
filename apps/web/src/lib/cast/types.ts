/** WebRTC signaling messages over Supabase Realtime broadcast. */
export type CastSignalPayload =
  | { type: 'host-online' }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; from: 'sender' | 'receiver'; candidate: RTCIceCandidateInit | null };

export const CAST_BROADCAST_EVENT = 'cast';
