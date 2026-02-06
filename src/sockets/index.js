const { Server } = require('socket.io');
const { verifyAccess } = require('../services/tokens');
const config = require('../config');
const { setIO, getIO } = require('./io');
const db = require('../db/pool');

let io = null;

const build = (httpServer) => {
  io = new Server(httpServer, {
    path: config.socket.path,
    cors: { origin: config.socket.cors, credentials: true },
    pingTimeout: 30000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(); // allow anonymous for public rooms
      const payload = verifyAccess(token);
      const r = await db.query('SELECT id, full_name, avatar_url FROM users WHERE id=$1', [payload.sub]);
      if (r.rows[0]) {
        socket.user = r.rows[0];
        socket.userId = r.rows[0].id;
      }
      next();
    } catch (e) {
      next();
    }
  });

  io.on('connection', (socket) => {
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
      db.query(
        `INSERT INTO presence(user_id, status, socket_id, last_seen_at) VALUES ($1,'online',$2,NOW())
         ON CONFLICT (user_id) DO UPDATE SET status='online', socket_id=EXCLUDED.socket_id, last_seen_at=NOW()`,
        [socket.user.id, socket.id]
      ).catch(() => {});
      io.emit('presence:update', { userId: socket.user.id, status: 'online' });
    }

    socket.on('room:join', (room) => {
      if (typeof room === 'string' && room.length < 100) socket.join(room);
    });
    socket.on('room:leave', (room) => socket.leave(room));

    socket.on('typing', ({ room, typing }) => {
      if (!socket.user || !room) return;
      socket.to(room).emit('typing', { userId: socket.user.id, name: socket.user.full_name, typing: !!typing });
    });

    socket.on('cursor', ({ room, position }) => {
      if (!socket.user || !room) return;
      socket.to(room).emit('cursor', { userId: socket.user.id, name: socket.user.full_name, position });
    });

    socket.on('presence:set', async (status) => {
      if (!socket.user) return;
      const s = ['online', 'away', 'dnd', 'offline'].includes(status) ? status : 'online';
      await db.query('UPDATE presence SET status=$1, last_seen_at=NOW() WHERE user_id=$2', [s, socket.user.id]);
      io.emit('presence:update', { userId: socket.user.id, status: s });
    });

    socket.on('disconnect', async () => {
      if (socket.user) {
        await db.query('UPDATE presence SET status=$1, last_seen_at=NOW() WHERE socket_id=$2', ['offline', socket.id]);
        io.emit('presence:update', { userId: socket.user.id, status: 'offline' });
      }
    });
  });

  return io;
};

module.exports = { build, getIO };
