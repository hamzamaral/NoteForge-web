import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import type { User } from './api';

export type PresenceUser = {
  userId: string;
  name: string;
  color: string;
  pageId: string;
  socketId?: string;
};

export type SyncStatus = 'idle' | 'connecting' | 'connected' | 'synced' | 'error';

const COLORS = ['#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#15803d', '#a21caf', '#c2410c'];

export function colorForUser(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function toB64(u8: Uint8Array) {
  let s = '';
  u8.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function fromB64(b64: string) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/** Minimal Yjs + Awareness provider over NoteForge Socket.IO /sync */
export class NoteForgeProvider {
  doc: Y.Doc;
  awareness: Awareness;
  socket: Socket;
  pageId: string;
  synced = false;
  destroyed = false;
  private listeners = new Set<(synced: boolean) => void>();

  constructor(pageId: string, token: string, user: { id: string; name: string; color: string }) {
    this.pageId = pageId;
    this.doc = new Y.Doc();
    this.awareness = new Awareness(this.doc);
    this.awareness.setLocalStateField('user', {
      name: user.name,
      color: user.color,
    });

    this.socket = io('/sync', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      this.socket.emit('joinPage', { pageId, name: user.name });
      const sv = Y.encodeStateVector(this.doc);
      this.socket
        .timeout(8000)
        .emit('yjsSync', { pageId, stateVector: toB64(sv) }, (err: Error | null, res?: { update?: string }) => {
          if (!err && res?.update) {
            Y.applyUpdate(this.doc, fromB64(res.update), 'remote');
          }
          this.markSynced();
        });
    });

    this.socket.on('yjsSync', (payload: { pageId: string; update: string }) => {
      if (payload.pageId !== pageId || !payload.update) return;
      Y.applyUpdate(this.doc, fromB64(payload.update), 'remote');
      this.markSynced();
    });

    this.socket.on('yjsUpdate', (payload: { update: string }) => {
      if (!payload?.update) return;
      Y.applyUpdate(this.doc, fromB64(payload.update), 'remote');
    });

    this.socket.on('awarenessUpdate', (payload: { update: string }) => {
      if (!payload?.update) return;
      applyAwarenessUpdate(this.awareness, fromB64(payload.update), 'remote');
    });

    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote' || this.destroyed) return;
      this.socket.emit('yjsUpdate', { pageId, update: toB64(update) });
    });

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === 'remote' || this.destroyed) return;
      const changed = [...added, ...updated, ...removed];
      const encoded = encodeAwarenessUpdate(this.awareness, changed);
      this.socket.emit('awarenessUpdate', { pageId, update: toB64(encoded) });
    });
  }

  onSynced(cb: (synced: boolean) => void) {
    this.listeners.add(cb);
    if (this.synced) cb(true);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private markSynced() {
    if (this.synced) return;
    this.synced = true;
    this.listeners.forEach((cb) => cb(true));
  }

  destroy() {
    this.destroyed = true;
    try {
      this.socket.emit('leavePage');
    } catch {
      /* ignore */
    }
    this.socket.disconnect();
    this.awareness.destroy();
    this.doc.destroy();
    this.listeners.clear();
  }
}

export function usePageSync(pageId: string | undefined, user: User | null) {
  const providerRef = useRef<NoteForgeProvider | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [provider, setProvider] = useState<NoteForgeProvider | null>(null);
  const [myColor, setMyColor] = useState('#0f766e');

  useEffect(() => {
    if (!pageId || !user) {
      providerRef.current?.destroy();
      providerRef.current = null;
      setProvider(null);
      setPresence([]);
      setStatus('idle');
      return;
    }

    const token = localStorage.getItem('nf_access');
    if (!token) {
      setStatus('error');
      return;
    }

    const color = colorForUser(user.id);
    setMyColor(color);
    setStatus('connecting');

    const p = new NoteForgeProvider(pageId, token, {
      id: user.id,
      name: user.fullName,
      color,
    });
    providerRef.current = p;
    setProvider(p);

    p.socket.on('connect', () => setStatus('connected'));
    p.socket.on('disconnect', () => setStatus('connecting'));
    p.socket.on('connect_error', () => setStatus('error'));
    p.socket.on('presence', (list: PresenceUser[]) => setPresence(list));
    const off = p.onSynced(() => setStatus('synced'));

    return () => {
      off();
      p.destroy();
      if (providerRef.current === p) providerRef.current = null;
      setProvider(null);
      setPresence([]);
      setStatus('idle');
    };
  }, [pageId, user?.id, user?.fullName]);

  return { presence, status, provider, myColor };
}
