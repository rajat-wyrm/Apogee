import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = io('/', { auth: { token } });
    s.on('connect', () => console.log('Socket connected'));
    s.on('projectCreated', () => console.log('Real-time: project created'));
    s.on('taskCreated', () => console.log('Real-time: task created'));
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  return socket;
}
