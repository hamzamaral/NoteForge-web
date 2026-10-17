import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type SearchHit } from '@/lib/api';

type Props = {
  open: boolean;
  workspaceId?: string;
  onClose: () => void;
  onSelect: (pageId: string) => void;
};

const MATCH_LABEL: Record<SearchHit['match'], string> = {
  title: 'Başlık',
  content: 'İçerik',
  task: 'Görev',
};

export function SearchPalette({ open, workspaceId, onClose, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ['search-palette', workspaceId, q],
    enabled: open && !!workspaceId && q.trim().length > 1,
    queryFn: async () =>
      (
        await api.get<SearchHit[]>(`/workspaces/${workspaceId}/search`, {
          params: { q },
        })
      ).data,
  });

  useEffect(() => {
    if (!open) {
      setQ('');
      setIndex(0);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [q]);

  const list = useMemo(() => hits, [hits]);

  if (!open) return null;

  function pick(id: string) {
    onSelect(id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Sayfa ara"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="text-slate-400">⌕</span>
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
            placeholder="Sayfa, içerik veya görev ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => (list.length ? (i + 1) % list.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) =>
                  list.length ? (i - 1 + list.length) % list.length : 0,
                );
              } else if (e.key === 'Enter' && list[index]) {
                e.preventDefault();
                pick(list[index].id);
              }
            }}
          />
          <kbd className="rounded border bg-panel px-1.5 py-0.5 text-[10px] text-slate-500">
            Esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {q.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              En az 2 karakter yaz · <kbd className="rounded border px-1 text-[10px]">Ctrl</kbd>+
              <kbd className="rounded border px-1 text-[10px]">K</kbd>
            </p>
          ) : isFetching && list.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Aranıyor…</p>
          ) : list.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              “{q.trim()}” için sonuç yok
            </p>
          ) : (
            list.map((hit, i) => (
              <button
                key={hit.id + hit.match}
                type="button"
                className={`flex w-full flex-col gap-0.5 px-4 py-2 text-left ${
                  i === index ? 'bg-accent/10' : 'hover:bg-panel'
                }`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => pick(hit.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {hit.icon || '📄'} <Highlight text={hit.title} q={q} />
                  </span>
                  <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                    {MATCH_LABEL[hit.match]}
                  </span>
                </div>
                {hit.snippet && (
                  <p className="truncate pl-6 text-xs text-slate-500">
                    <Highlight text={hit.snippet} q={q} />
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(needle.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-100 px-0.5 text-ink">{text.slice(idx, idx + needle.length)}</mark>
      {text.slice(idx + needle.length)}
    </>
  );
}
