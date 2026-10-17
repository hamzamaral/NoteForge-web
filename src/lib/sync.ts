import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { User } from './api';

export function usePageSync(pageId: string | undefined, user: User | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!pageId || !user) return;
    const socket = io('/sync', { path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.emit('joinPage', { pageId, userId: user.id, name: user.fullName });
    socket.on('presence', (list: { name: string; color: string }[]) => {
      // Presence available for UI chips — logged for demo
      if (list.length > 1) {
        // eslint-disable-next-line no-console
        console.debug('[presence]', list.map((p) => p.name).join(', '));
      }
    });
    return () => {
      socket.emit('leavePage');
      socket.disconnect();
    };
  }, [pageId, user]);
}
