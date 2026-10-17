import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';

type Share = {
  id: string;
  token: string;
  permission: 'READ' | 'COMMENT';
  createdAt: string;
};

export function SharePanel({
  pageId,
  open,
  onClose,
}: {
  pageId: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [permission, setPermission] = useState<'READ' | 'COMMENT'>('READ');

  const { data: shares = [] } = useQuery({
    queryKey: ['shares', pageId],
    enabled: open,
    queryFn: async () => (await api.get<Share[]>(`/pages/${pageId}/shares`)).data,
  });

  const create = useMutation({
    mutationFn: () => api.post('/shares', { pageId, permission }),
    onSuccess: (res) => {
      const url = `${window.location.origin}/share/${res.data.token}`;
      void navigator.clipboard.writeText(url);
      void qc.invalidateQueries({ queryKey: ['shares', pageId] });
      toast.success('Link oluşturuldu ve kopyalandı');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/shares/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shares', pageId] });
      toast.message('Paylaşım iptal edildi');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Sayfayı paylaş</h2>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Herkese açık link — giriş gerekmez.
        </p>

        <div className="mt-4 flex gap-2">
          <select
            className="rounded border px-2 text-sm"
            value={permission}
            onChange={(e) => setPermission(e.target.value as 'READ' | 'COMMENT')}
          >
            <option value="READ">Salt okunur</option>
            <option value="COMMENT">Yorum (yakında public)</option>
          </select>
          <button
            type="button"
            className="rounded bg-accent px-3 py-1.5 text-sm text-white"
            onClick={() => create.mutate()}
          >
            Link oluştur
          </button>
        </div>

        <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
          {shares.map((s) => {
            const url = `${window.location.origin}/share/${s.token}`;
            return (
              <li key={s.id} className="rounded-lg bg-panel px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase text-slate-500">
                    {s.permission === 'READ' ? 'Okuma' : 'Yorum'}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => revoke.mutate(s.id)}
                  >
                    İptal
                  </button>
                </div>
                <button
                  type="button"
                  className="mt-1 w-full truncate text-left text-xs text-accent underline"
                  onClick={() => {
                    void navigator.clipboard.writeText(url);
                    toast.success('Kopyalandı');
                  }}
                >
                  {url}
                </button>
              </li>
            );
          })}
          {!shares.length && (
            <li className="text-xs text-slate-500">Aktif paylaşım yok.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
