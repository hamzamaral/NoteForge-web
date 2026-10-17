import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { User } from './api';

export type PresenceUser = { userId: string; name: string; color: string; pageId: string };

export function usePageSync(pageId: string | undefined, user: User | null) {
  const socketRef = useRef<Socket | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!pageId || !user) {
      setPresence([]);
      return;
    }
    const socket = io('/sync', { path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.emit('joinPage', { pageId, userId: user.id, name: user.fullName });
    socket.on('presence', (list: PresenceUser[]) => setPresence(list));
    return () => {
      socket.emit('leavePage');
      socket.disconnect();
      setPresence([]);
    };
  }, [pageId, user]);

  return { presence };
}
