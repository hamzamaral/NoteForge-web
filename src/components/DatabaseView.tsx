import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

type Db = {
  id: string;
  name: string;
  properties: { id: string; name: string; type: string; options?: string[] }[];
  views: { id: string; name: string; type: string; config: Record<string, unknown> }[];
  rows: { id: string; values: Record<string, unknown> }[];
};

export function DatabaseView({ pageId }: { pageId: string }) {
  const qc = useQueryClient();
  const [viewType, setViewType] = useState<'table' | 'board'>('table');
  const { data: db } = useQuery({
    queryKey: ['db-by-page', pageId],
    queryFn: async () => (await api.get<Db | null>(`/databases/by-page/${pageId}`)).data,
  });

  const addRow = useMutation({
    mutationFn: () =>
      api.post(`/databases/${db!.id}/rows`, {
        values: { Ad: 'Yeni', Durum: 'Yeni' },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['db-by-page', pageId] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateRow = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      api.patch(`/databases/rows/${id}`, { values }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['db-by-page', pageId] }),
  });

  const groups = useMemo(() => {
    if (!db) return {};
    const map: Record<string, typeof db.rows> = {};
    for (const row of db.rows) {
      const key = String(row.values.Durum || '—');
      (map[key] ||= []).push(row);
    }
    return map;
  }, [db]);

  if (!db) {
    return (
      <p className="text-sm text-slate-500">
        Bu sayfa bir veritabanı değil. Sidebar’dan “Veritabanı oluştur” deneyin.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl font-semibold">{db.name}</h2>
        <button
          type="button"
          className={`rounded px-2 py-1 text-xs ${viewType === 'table' ? 'bg-accent text-white' : 'bg-panel'}`}
          onClick={() => setViewType('table')}
        >
          Tablo
        </button>
        <button
          type="button"
          className={`rounded px-2 py-1 text-xs ${viewType === 'board' ? 'bg-accent text-white' : 'bg-panel'}`}
          onClick={() => setViewType('board')}
        >
          Board
        </button>
        <button
          type="button"
          className="ml-auto rounded border px-2 py-1 text-xs"
          onClick={() => addRow.mutate()}
        >
          Satır ekle
        </button>
      </div>

      {viewType === 'table' ? (
        <div className="overflow-x-auto border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
              <tr>
                {db.properties.map((p) => (
                  <th key={p.id} className="px-3 py-2">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {db.rows.map((row) => (
                <tr key={row.id} className="border-t">
                  {db.properties.map((p) => (
                    <td key={p.id} className="px-3 py-2">
                      {p.type === 'select' ? (
                        <select
                          className="rounded border px-1"
                          value={String(row.values[p.name] ?? '')}
                          onChange={(e) =>
                            updateRow.mutate({
                              id: row.id,
                              values: { ...row.values, [p.name]: e.target.value },
                            })
                          }
                        >
                          {(p.options as string[] | undefined)?.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          )) || null}
                        </select>
                      ) : (
                        <input
                          className="w-full rounded border px-1"
                          value={String(row.values[p.name] ?? '')}
                          onChange={(e) =>
                            updateRow.mutate({
                              id: row.id,
                              values: { ...row.values, [p.name]: e.target.value },
                            })
                          }
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(groups).map(([status, rows]) => (
            <div key={status} className="rounded-xl border bg-white p-2">
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">{status}</h3>
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.id} className="rounded-lg bg-panel px-2 py-2 text-sm">
                    {String(row.values.Ad || '—')}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
