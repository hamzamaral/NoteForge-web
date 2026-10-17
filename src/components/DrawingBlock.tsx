import { lazy, Suspense, useMemo, useState } from 'react';

const Excalidraw = lazy(async () => {
  const m = await import('@excalidraw/excalidraw');
  return { default: m.Excalidraw };
});

type Props = {
  title?: string;
  initialData?: unknown;
  onSave: (data: unknown) => void;
  onRemove?: () => void;
};

export function DrawingBlock({ title = 'Çizim notu', initialData, onSave, onRemove }: Props) {
  const [open, setOpen] = useState(!initialData);
  const [scene, setScene] = useState<Record<string, unknown> | undefined>(
    (initialData as Record<string, unknown> | undefined) || undefined,
  );
  const [dirty, setDirty] = useState(false);

  const count = useMemo(() => {
    const els = scene?.elements;
    return Array.isArray(els)
      ? els.filter((e) => !(e as { isDeleted?: boolean }).isDeleted).length
      : 0;
  }, [scene]);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-panel/50 px-3 py-2">
        <div>
          <span className="text-sm font-medium">{title}</span>
          <span className="ml-2 text-[11px] text-slate-400">
            {count} öğe{dirty ? ' · kaydedilmedi' : scene ? ' · kayıtlı' : ''}
          </span>
        </div>
        <div className="flex gap-1">
          {onRemove && (
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs text-red-600"
              onClick={onRemove}
            >
              Kaldır
            </button>
          )}
          <button
            type="button"
            className="rounded bg-accent px-2 py-1 text-xs text-white"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Küçült' : 'Düzenle'}
          </button>
        </div>
      </div>
      {open ? (
        <div>
          <div className="h-[460px]">
            <Suspense fallback={<p className="p-4 text-sm text-slate-500">Çizim yükleniyor…</p>}>
              <Excalidraw
                // Excalidraw types are strict; scene is opaque JSON for our store
                initialData={
                  (scene?.elements
                    ? {
                        elements: scene.elements,
                        appState: {
                          viewBackgroundColor: '#f6f4ef',
                          ...(typeof scene.appState === 'object' && scene.appState
                            ? scene.appState
                            : {}),
                        },
                        files: scene.files,
                      }
                    : {
                        appState: { viewBackgroundColor: '#f6f4ef' },
                      }) as never
                }
                onChange={(elements, appState, files) => {
                  setScene({
                    elements: [...elements],
                    appState: { ...(appState as object) },
                    files,
                  });
                  setDirty(true);
                }}
              />
            </Suspense>
          </div>
          <div className="flex justify-end gap-2 border-t p-2">
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm"
              onClick={() => {
                setScene(undefined);
                setDirty(true);
              }}
            >
              Temizle
            </button>
            <button
              type="button"
              className="rounded bg-accent px-3 py-1.5 text-sm text-white"
              onClick={() => {
                onSave(scene || { elements: [], appState: { viewBackgroundColor: '#f6f4ef' } });
                setDirty(false);
                setOpen(false);
              }}
            >
              Kaydet
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="w-full p-6 text-left text-sm text-slate-500 hover:bg-panel/40"
          onClick={() => setOpen(true)}
        >
          {count
            ? `Çizim hazır (${count} öğe) — düzenlemek için tıkla.`
            : 'Henüz çizim yok — tıkla ve Excalidraw ile çiz.'}
        </button>
      )}
    </div>
  );
}
