import { createServer } from 'node:http';
import { createApp } from './app.js';
import { closeDatabase } from './config/database.js';
import { env } from './config/env.js';
import { pushNotificationsConfigured } from './lib/push-notifications.js';
import { liveKitConfigured } from './lib/livekit.js';
import { createRealtimeServer } from './lib/realtime.js';

const app = createApp();
const server = createServer(app);
const io = createRealtimeServer(server);
app.set('io', io);

server.listen(env.PORT, env.HOST, () => {
  console.log(`BizChat API listening on http://${env.HOST}:${env.PORT}`);
  console.log(`FCM push notifications: ${pushNotificationsConfigured() ? 'configured' : 'disabled (service account missing)'}`);
  console.log(`LiveKit calling: ${liveKitConfigured() ? 'configured' : 'disabled (credentials missing)'}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  io.close();
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
