import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage, type Task } from '@/lib/api';
import { DateField } from '@/components/DateField';
import { fromDateInputValue } from '@/lib/dates';
import { useMemo, useState } from 'react';

const STATUS_LABEL: Record<Task['status'], string> = {
  TODO: 'Yapılacak',
  DOING: 'Devam',
  DONE: 'Bitti',
};

export function TaskPanel({
  workspaceId,
  pageId,
  seedTodos,
}: {
  workspaceId: string;
  pageId?: string;
  /** Editördeki checkbox metinlerini panelle senkronlamak için */
  seedTodos?: { text: string; checked: boolean }[];
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [filter, setFilter] = useState<'ALL' | Task['status']>('ALL');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', workspaceId, pageId],
    queryFn: async () =>
      (
        await api.get<Task[]>('/tasks', {
          params: { workspaceId, pageId },
        })
      ).data,
  });

  const visible = useMemo(
    () => (filter === 'ALL' ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter],
  );

  const counts = useMemo(() => {
    const c = { TODO: 0, DOING: 0, DONE: 0 };
    for (const t of tasks) c[t.status]++;
    return c;
  }, [tasks]);

  const create = useMutation({
    mutationFn: (payload: { title: string; dueAt?: string; status?: Task['status'] }) =>
      api.post('/tasks', { workspaceId, pageId, ...payload }),
    onSuccess: () => {
      setTitle('');
      setDueAt('');
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      status?: Task['status'];
      title?: string;
      dueAt?: string | null;
    }) => api.patch(`/tasks/${id}`, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  async function importFromEditor() {
    if (!seedTodos?.length) {
      toast.message('Editörde checkbox bulunamadı');
      return;
    }
    const existing = new Set(tasks.map((t) => t.title.trim().toLowerCase()));
    let n = 0;
    for (const t of seedTodos) {
      const text = t.text.trim();
      if (!text || existing.has(text.toLowerCase())) continue;
      await api.post('/tasks', {
        workspaceId,
        pageId,
        title: text,
        status: t.checked ? 'DONE' : 'TODO',
      });
      n++;
    }
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    toast.success(n ? `${n} görev paneline alındı` : 'Yeni görev yok (zaten var)');
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white/70 p-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Bu sayfadaki işler
      </h2>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {counts.TODO} bekleyen · {counts.DOING} devam · {counts.DONE} bitti
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        {(['ALL', 'TODO', 'DOING', 'DONE'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`rounded px-1.5 py-0.5 text-[10px] ${
              filter === s ? 'bg-accent text-white' : 'bg-panel text-slate-600'
            }`}
            onClick={() => setFilter(s)}
          >
            {s === 'ALL' ? 'Tümü' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <form
        className="mt-2 space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) {
            create.mutate({
              title: title.trim(),
              dueAt: fromDateInputValue(dueAt) || undefined,
            });
          }
        }}
      >
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Yeni görev…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex gap-1">
          <input
            type="date"
            className="min-w-0 flex-1 rounded border bg-white px-2 py-1.5 text-xs"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            title="Bitiş tarihi"
          />
          <button type="submit" className="rounded bg-accent px-2 text-sm text-white">
            +
          </button>
        </div>
      </form>

      <button
        type="button"
        className="mt-2 w-full rounded border border-dashed px-2 py-1 text-[11px] text-slate-600 hover:border-accent hover:text-accent"
        onClick={() => void importFromEditor()}
      >
        Editör checkbox → panele aktar
      </button>

      <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {visible.map((t) => (
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
            <DateField
              className="mt-1 w-full rounded border bg-white px-1 py-1 text-xs"
              value={t.dueAt}
              title="Bitiş tarihi"
              onCommit={(iso) => update.mutate({ id: t.id, dueAt: iso })}
            />
          </li>
        ))}
        {!visible.length && (
          <li className="text-xs text-slate-500">Bu filtrede görev yok.</li>
        )}
      </ul>
    </aside>
  );
}
