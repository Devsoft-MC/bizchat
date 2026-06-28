import { io, type Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import type { Call } from './types';

type CallSocket = Socket<{
  'call:incoming': (call: Call) => void;
  'call:updated': (call: Call) => void;
}>;

function defaultRealtimeUrl() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl?.startsWith('http://') || apiUrl?.startsWith('https://')) {
    return new URL(apiUrl).origin;
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:5001';
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return 'http://localhost:5001';
  }
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'http://localhost:5001';
}

export function connectRealtime(token: string): CallSocket {
  return io(process.env.EXPO_PUBLIC_REALTIME_URL || defaultRealtimeUrl(), {
    path: process.env.EXPO_PUBLIC_SOCKET_IO_PATH || '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
}
