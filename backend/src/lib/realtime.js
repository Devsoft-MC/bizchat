import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';

export function createRealtimeServer(httpServer) {
  const io = new Server(httpServer, {
    path: env.SOCKET_IO_PATH,
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.auth = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
      next();
    } catch {
      next(new Error('authentication_required'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.auth.sub}`);
    socket.join(`company:${socket.auth.companyId}`);
  });

  return io;
}
