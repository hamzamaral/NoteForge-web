import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type AuditRow = {
  id: string;
  action: string;
  meta: Record<string, unknown>;
  createdAt: string;
  actor?: { fullName: string; email: string } | null;
};

export function AuditPanel({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['audit', workspaceId],
    enabled: open && !!workspaceId,
    queryFn: async () =>
      (await api.get<AuditRow[]>(`/admin/workspaces/${workspaceId}/audit`)).data,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[70vh] w-full max-w-lg overflow-hidden rounded-xl border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Denetim kaydı"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Denetim (audit)</h2>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            Kapat
          </button>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {isLoading && <li className="p-3 text-sm text-slate-500">Yükleniyor…</li>}
          {!isLoading && !rows.length && (
            <li className="p-3 text-sm text-slate-500">Kayıt yok</li>
          )}
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg px-3 py-2 text-sm hover:bg-panel">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{r.action}</span>
                <span className="text-[11px] text-slate-400">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {r.actor?.fullName || r.actor?.email || 'sistem'}
                {r.meta && Object.keys(r.meta).length > 0
                  ? ` · ${JSON.stringify(r.meta).slice(0, 80)}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
