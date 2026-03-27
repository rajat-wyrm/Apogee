import { io } from 'socket.io-client';
import { useAuthStore, useNotificationStore } from '../store';
import toast from 'react-hot-toast';

let socket = null;

export const connectSocket = () => {
  if (socket?.connected) return socket;
  const token = useAuthStore.getState().accessToken;
  socket = io('/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    withCredentials: true,
  });

  socket.on('connect', () => console.log('[socket] connected'));
  socket.on('disconnect', () => console.log('[socket] disconnected'));

  socket.on('notification:new', (n) => {
    useNotificationStore.getState().add(n);
    if (n.type === 'mention' || n.type === 'assigned') {
      toast(n.title, { icon: '🔔' });
    }
  });
  socket.on('notify', ({ title, body }) => toast(title, { icon: '🔔' }));

  socket.on('task:created', () => {});
  socket.on('task:updated', () => {});
  socket.on('task:moved', () => {});
  socket.on('task:deleted', () => {});
  socket.on('comment:created', () => {});
  socket.on('project:updated', () => {});
  socket.on('doc:updated', () => {});

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinRoom = (room) => socket?.emit('room:join', room);
export const leaveRoom = (room) => socket?.emit('room:leave', room);
export const emitTyping = (room, typing) => socket?.emit('typing', { room, typing });
export const emitCursor = (room, position) => socket?.emit('cursor', { room, position });

export const getSocket = () => socket;
