import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, type Task } from '@/lib/api';
import { useState } from 'react';

export function TaskPanel({
  workspaceId,
  pageId,
}: {
  workspaceId: string;
  pageId?: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', workspaceId, pageId],
    queryFn: async () =>
      (
        await api.get<Task[]>('/tasks', {
          params: { workspaceId, pageId },
        })
      ).data,
  });

  const create = useMutation({
    mutationFn: () => api.post('/tasks', { workspaceId, pageId, title }),
    onSuccess: () => {
      setTitle('');
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task['status'] }) =>
      api.patch(`/tasks/${id}`, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white/70 p-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Bu sayfadaki işler
      </h2>
      <form
        className="mt-2 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
          placeholder="Yeni görev…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="rounded bg-accent px-2 text-sm text-white">
          +
        </button>
      </form>
      <ul className="mt-3 space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="rounded-lg bg-panel px-2 py-1.5 text-sm">
            <div className="flex items-start justify-between gap-1">
              <span className={t.status === 'DONE' ? 'line-through text-slate-400' : ''}>
                {t.title}
              </span>
              <button
                type="button"
                className="text-xs text-red-600"
                onClick={() => remove.mutate(t.id)}
              >
                ×
              </button>
            </div>
            <select
              className="mt-1 w-full rounded border bg-white text-xs"
              value={t.status}
              onChange={(e) =>
                update.mutate({ id: t.id, status: e.target.value as Task['status'] })
              }
            >
              <option value="TODO">Yapılacak</option>
              <option value="DOING">Devam</option>
              <option value="DONE">Bitti</option>
            </select>
          </li>
        ))}
        {!tasks.length && (
          <li className="text-xs text-slate-500">Henüz görev yok.</li>
        )}
      </ul>
    </aside>
  );
}
