import { AccessToken } from 'livekit-server-sdk';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

export function liveKitConfigured() {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

export async function createRoomToken({ roomName, userId, displayName }) {
  if (!liveKitConfigured()) {
    throw new AppError(503, 'calling_not_configured', 'Audio and video calling is not configured on this server yet');
  }

  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: userId,
    name: displayName,
    ttl: '15m'
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  });

  return { token: await token.toJwt(), url: env.LIVEKIT_URL };
}
