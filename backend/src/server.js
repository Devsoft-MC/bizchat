import { createApp } from './app.js';
import { closeDatabase } from './config/database.js';
import { env } from './config/env.js';

const server = createApp().listen(env.PORT, env.HOST, () => {
  console.log(`BizChat API listening on http://${env.HOST}:${env.PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
