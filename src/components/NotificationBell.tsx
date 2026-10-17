import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

type N = {
  id: string;
  title: string;
  body?: string | null;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: unread } = useQuery({
    queryKey: ['notif-count'],
    queryFn: async () => (await api.get<{ count: number }>('/notifications/unread-count')).data,
    refetchInterval: 30_000,
  });
  const { data: items = [] } = useQuery({
    queryKey: ['notifications'],
    enabled: open,
    queryFn: async () => (await api.get<N[]>('/notifications')).data,
  });
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notif-count'] });
    },
  });

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded border px-2 py-1 text-xs"
        aria-label="Bildirimler"
        onClick={() => setOpen((v) => !v)}
      >
        🔔
        {(unread?.count || 0) > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[9px] text-white">
            {unread!.count}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-72 rounded-lg border bg-white shadow-lg"
          role="dialog"
          aria-label="Bildirim kutusu"
        >
          <div className="flex items-center justify-between border-b px-2 py-1.5 text-xs">
            <span className="font-semibold">Bildirimler</span>
            <button type="button" className="text-accent" onClick={() => readAll.mutate()}>
              Tümünü okundu
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto text-sm">
            {items.map((n) => (
              <li
                key={n.id}
                className={`border-b px-2 py-2 ${n.readAt ? 'opacity-60' : 'bg-accent/5'}`}
              >
                {n.href ? (
                  <Link to={n.href} className="font-medium text-accent" onClick={() => setOpen(false)}>
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-medium">{n.title}</p>
                )}
                {n.body && <p className="text-[11px] text-slate-500">{n.body}</p>}
              </li>
            ))}
            {!items.length && (
              <li className="px-2 py-4 text-center text-xs text-slate-500">Bildirim yok</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
