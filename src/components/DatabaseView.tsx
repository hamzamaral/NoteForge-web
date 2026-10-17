import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '@/lib/api';
import { DateField } from '@/components/DateField';
import { toDateInputValue } from '@/lib/dates';
import { toast } from 'sonner';

type Prop = {
  id: string;
  name: string;
  type: string;
  options?: string[] | unknown;
};
type View = {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
};
type Row = { id: string; values: Record<string, unknown> };
type Db = {
  id: string;
  name: string;
  properties: Prop[];
  views: View[];
  rows: Row[];
};

function optsOf(p: Prop): string[] {
  return Array.isArray(p.options) ? (p.options as string[]) : [];
}

export function DatabaseView({ pageId }: { pageId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [viewType, setViewType] = useState<'table' | 'board' | 'calendar' | 'gallery' | 'list'>(
    'table',
  );
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('Ad');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState('text');
  const [dragRowId, setDragRowId] = useState<string | null>(null);

  const { data: db } = useQuery({
    queryKey: ['db-by-page', pageId],
    queryFn: async () => (await api.get<Db | null>(`/databases/by-page/${pageId}`)).data,
  });

  const tableView = db?.views.find((v) => v.type === 'table');
  const boardView = db?.views.find((v) => v.type === 'board');
  const statusProp = db?.properties.find((p) => p.type === 'select' && p.name === 'Durum');
  const groupBy = String(boardView?.config?.groupBy || statusProp?.name || 'Durum');

  useEffect(() => {
    if (!tableView?.config) return;
    if (typeof tableView.config.sortBy === 'string') setSortBy(tableView.config.sortBy);
    if (tableView.config.sortDir === 'asc' || tableView.config.sortDir === 'desc') {
      setSortDir(tableView.config.sortDir);
    }
    const f = tableView.config.filter as { Durum?: string } | undefined;
    if (f?.Durum) setFilterStatus(f.Durum);
  }, [tableView?.id]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['db-by-page', pageId] });

  const addRow = useMutation({
    mutationFn: () => api.post(`/databases/${db!.id}/rows`, { values: {} }),
    onSuccess: invalidate,
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateRow = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      api.patch(`/databases/rows/${id}`, { values }),
    onSuccess: invalidate,
  });

  const deleteRow = useMutation({
    mutationFn: (id: string) => api.delete(`/databases/rows/${id}`),
    onSuccess: invalidate,
  });

  const openAsPage = useMutation({
    mutationFn: async (rowId: string) =>
      (await api.post<{ id: string }>(`/databases/rows/${rowId}/open-page`)).data,
    onSuccess: (page) => {
      void qc.invalidateQueries({ queryKey: ['pages'] });
      navigate(`/p/${page.id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addProperty = useMutation({
    mutationFn: () =>
      api.post(`/databases/${db!.id}/properties`, {
        name: newPropName.trim(),
        type: newPropType,
        options: newPropType === 'select' ? ['A', 'B', 'C'] : [],
      }),
    onSuccess: () => {
      setNewPropName('');
      invalidate();
      toast.success('Kolon eklendi');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteProperty = useMutation({
    mutationFn: (id: string) => api.delete(`/databases/properties/${id}`),
    onSuccess: invalidate,
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const renameDb = useMutation({
    mutationFn: (name: string) => api.patch(`/databases/${db!.id}`, { name }),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ['pages'] });
    },
  });

  const saveViewConfig = useMutation({
    mutationFn: () => {
      const view = viewType === 'table' ? tableView : boardView;
      if (!view) return Promise.resolve(null);
      return api.patch(`/databases/views/${view.id}`, {
        config: {
          sortBy,
          sortDir,
          groupBy,
          filter: filterStatus ? { Durum: filterStatus } : {},
        },
      });
    },
    onSuccess: () => toast.message('Görünüm kaydedildi'),
  });

  const rows = useMemo(() => {
    if (!db) return [];
    let list = [...db.rows];
    if (filterStatus) {
      list = list.filter((r) => String(r.values.Durum || '') === filterStatus);
    }
    list.sort((a, b) => {
      const av = a.values[sortBy];
      const bv = b.values[sortBy];
      const as = av == null ? '' : String(av);
      const bs = bv == null ? '' : String(bv);
      const an = Number(av);
      const bn = Number(bv);
      let cmp = 0;
      if (!Number.isNaN(an) && !Number.isNaN(bn) && as !== '' && bs !== '') cmp = an - bn;
      else cmp = as.localeCompare(bs, 'tr');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [db, filterStatus, sortBy, sortDir]);

  const groups = useMemo(() => {
    if (!db) return {} as Record<string, Row[]>;
    const options = statusProp ? optsOf(statusProp) : ['Yeni', 'Devam', 'Bitti'];
    const map: Record<string, Row[]> = {};
    for (const o of options) map[o] = [];
    map['—'] = [];
    for (const row of rows) {
      const key = String(row.values[groupBy] || '—');
      (map[key] ||= []).push(row);
    }
    if (!map['—'].length) delete map['—'];
    return map;
  }, [db, rows, groupBy, statusProp]);

  if (!db) {
    return (
      <p className="text-sm text-slate-500">
        Bu sayfa tablo değil. Sidebar’dan <strong>Tablo sayfası ekle</strong> ile Notion tarzı
        satır+özellik sayfası aç (Postgres’e dokunmaz).
      </p>
    );
  }

  function cellEditor(p: Prop, row: Row) {
    const value = row.values[p.name];
    if (p.type === 'select') {
      return (
        <select
          className="w-full rounded border px-1"
          value={String(value ?? '')}
          onChange={(e) =>
            updateRow.mutate({
              id: row.id,
              values: { ...row.values, [p.name]: e.target.value },
            })
          }
        >
          {optsOf(p).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    if (p.type === 'number') {
      return (
        <input
          type="number"
          className="w-full rounded border px-1"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) =>
            updateRow.mutate({
              id: row.id,
              values: {
                ...row.values,
                [p.name]: e.target.value === '' ? null : Number(e.target.value),
              },
            })
          }
        />
      );
    }
    if (p.type === 'date') {
      return (
        <DateField
          className="w-full rounded border bg-white px-1 py-0.5 text-xs"
          value={typeof value === 'string' ? value : toDateInputValue(value as string)}
          onCommit={(iso) =>
            updateRow.mutate({
              id: row.id,
              values: { ...row.values, [p.name]: iso ? iso.slice(0, 10) : '' },
            })
          }
        />
      );
    }
    return (
      <input
        className="w-full rounded border px-1"
        value={String(value ?? '')}
        onChange={(e) =>
          updateRow.mutate({
            id: row.id,
            values: { ...row.values, [p.name]: e.target.value },
          })
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Uygulama içi <strong>tablo sayfası</strong> (Notion tarzı) — satırlar + özellikler + board.
        Gerçek Postgres DB değil; silmek için sayfayı çöpe atman yeterli.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="font-display bg-transparent text-xl font-semibold outline-none"
          value={db.name}
          onChange={(e) => renameDb.mutate(e.target.value)}
        />
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
          className={`rounded px-2 py-1 text-xs ${viewType === 'calendar' ? 'bg-accent text-white' : 'bg-panel'}`}
          onClick={() => setViewType('calendar')}
        >
          Takvim
        </button>
        <button
          type="button"
          className={`rounded px-2 py-1 text-xs ${viewType === 'gallery' ? 'bg-accent text-white' : 'bg-panel'}`}
          onClick={() => setViewType('gallery')}
        >
          Galeri
        </button>
        <button
          type="button"
          className={`rounded px-2 py-1 text-xs ${viewType === 'list' ? 'bg-accent text-white' : 'bg-panel'}`}
          onClick={() => setViewType('list')}
        >
          Liste
        </button>
        <select
          className="rounded border px-1 text-xs"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Durum: tümü</option>
          {(statusProp ? optsOf(statusProp) : []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          className="rounded border px-1 text-xs"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          {db.properties.map((p) => (
            <option key={p.id} value={p.name}>
              Sıra: {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs"
          onClick={() => saveViewConfig.mutate()}
        >
          Görünümü kaydet
        </button>
        <button
          type="button"
          className="ml-auto rounded border px-2 py-1 text-xs"
          onClick={() => addRow.mutate()}
        >
          Satır ekle
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-panel/40 p-2 text-xs">
        <label>
          Yeni kolon
          <input
            className="ml-1 rounded border px-1 py-0.5"
            placeholder="İsim"
            value={newPropName}
            onChange={(e) => setNewPropName(e.target.value)}
          />
        </label>
        <select
          className="rounded border px-1 py-0.5"
          value={newPropType}
          onChange={(e) => setNewPropType(e.target.value)}
        >
          <option value="text">text</option>
          <option value="number">number</option>
          <option value="select">select</option>
          <option value="multi_select">multi_select</option>
          <option value="checkbox">checkbox</option>
          <option value="url">url</option>
          <option value="date">date</option>
          <option value="person">person</option>
          <option value="files">files</option>
        </select>
        <button
          type="button"
          className="rounded bg-accent px-2 py-1 text-white"
          disabled={!newPropName.trim()}
          onClick={() => addProperty.mutate()}
        >
          Ekle
        </button>
        <span className="text-slate-400">· kolon silmek için başlıktaki ×</span>
      </div>

      {viewType === 'table' && (
        <div className="overflow-x-auto border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
              <tr>
                {db.properties.map((p) => (
                  <th key={p.id} className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      {p.name}
                      <span className="font-normal normal-case text-slate-400">{p.type}</span>
                      {p.name !== 'Ad' && (
                        <button
                          type="button"
                          className="text-red-500"
                          title="Kolonu sil"
                          onClick={() => {
                            if (confirm(`“${p.name}” kolonu silinsin mi?`)) {
                              deleteProperty.mutate(p.id);
                            }
                          }}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  {db.properties.map((p) => (
                    <td key={p.id} className="px-3 py-2">
                      {cellEditor(p, row)}
                    </td>
                  ))}
                  <td className="px-2 py-2 space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-xs text-accent"
                      onClick={() => openAsPage.mutate(row.id)}
                    >
                      Sayfa
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => deleteRow.mutate(row.id)}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="p-4 text-sm text-slate-500">Filtreye uyan satır yok.</p>
          )}
        </div>
      )}

      {viewType === 'board' && (
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(groups).map(([status, groupRows]) => (
            <div
              key={status}
              className="min-h-[140px] rounded-xl border bg-white p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!dragRowId) return;
                const row = db.rows.find((r) => r.id === dragRowId);
                if (!row) return;
                updateRow.mutate({
                  id: row.id,
                  values: { ...row.values, [groupBy]: status === '—' ? '' : status },
                });
                setDragRowId(null);
              }}
            >
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                {status} · {groupRows.length}
              </h3>
              <ul className="space-y-2">
                {groupRows.map((row) => (
                  <li
                    key={row.id}
                    draggable
                    onDragStart={() => setDragRowId(row.id)}
                    className="cursor-grab rounded-lg bg-panel px-2 py-2 text-sm active:cursor-grabbing"
                  >
                    <div className="font-medium">{String(row.values.Ad || '—')}</div>
                    {row.values.Öncelik != null && (
                      <div className="text-[10px] text-slate-500">
                        Öncelik: {String(row.values.Öncelik)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {viewType === 'calendar' && (
        <div className="space-y-2 rounded-xl border bg-white p-3">
          <p className="text-xs text-slate-500">Tarih alanına göre (Tarih)</p>
          <ul className="space-y-2">
            {rows
              .slice()
              .sort((a, b) => String(a.values.Tarih || '').localeCompare(String(b.values.Tarih || '')))
              .map((row) => (
                <li key={row.id} className="flex items-center gap-3 rounded-lg bg-panel px-3 py-2 text-sm">
                  <span className="w-28 shrink-0 font-mono text-xs text-accent">
                    {String(row.values.Tarih || '—')}
                  </span>
                  <span className="font-medium">{String(row.values.Ad || 'Adsız')}</span>
                  <span className="ml-auto text-[10px] text-slate-500">
                    {String(row.values.Durum || '')}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {viewType === 'gallery' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-panel text-3xl text-slate-300">
                ▦
              </div>
              <h3 className="font-medium">{String(row.values.Ad || '—')}</h3>
              <p className="text-xs text-slate-500">
                {String(row.values.Durum || '')} · {String(row.values.Öncelik || '')}
              </p>
            </div>
          ))}
        </div>
      )}

      {viewType === 'list' && (
        <ul className="divide-y rounded-xl border bg-white">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{String(row.values.Ad || '—')}</span>
              <span className="text-xs text-slate-400">{String(row.values.Durum || '')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
