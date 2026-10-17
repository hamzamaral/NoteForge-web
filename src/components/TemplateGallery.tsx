import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Tpl = { key: string; title: string; description: string };

export function TemplateGallery({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    enabled: open,
    queryFn: async () => (await api.get<Tpl[]>('/templates')).data,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Şablon galerisi</h2>
          <button type="button" className="text-slate-500" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">Yeni sayfa bu şablonla açılır.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.key}
              type="button"
              className="rounded-xl border border-slate-200 p-3 text-left hover:border-accent hover:bg-accent/5"
              onClick={() => {
                onPick(t.key);
                onClose();
              }}
            >
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-slate-500">{t.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
