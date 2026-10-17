import { lazy, Suspense, useState } from 'react';

const Excalidraw = lazy(async () => {
  const m = await import('@excalidraw/excalidraw');
  return { default: m.Excalidraw };
});

type Props = {
  initialData?: unknown;
  onSave: (data: unknown) => void;
};

export function DrawingBlock({ initialData, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [scene, setScene] = useState(initialData);

  return (
    <div className="my-3 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Çizim notu</span>
        <button
          type="button"
          className="rounded bg-accent px-2 py-1 text-xs text-white"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Küçült' : 'Düzenle'}
        </button>
      </div>
      {open ? (
        <div className="h-[420px]">
          <Suspense fallback={<p className="p-4 text-sm text-slate-500">Çizim yükleniyor…</p>}>
            <Excalidraw
              initialData={
                scene
                  ? (scene as object)
                  : { appState: { viewBackgroundColor: '#f6f4ef' } }
              }
              onChange={(elements, appState, files) => {
                const next = { elements, appState, files };
                setScene(next);
              }}
            />
          </Suspense>
          <div className="border-t p-2 text-right">
            <button
              type="button"
              className="rounded bg-accent px-3 py-1.5 text-sm text-white"
              onClick={() => {
                onSave(scene);
                setOpen(false);
              }}
            >
              Kaydet
            </button>
          </div>
        </div>
      ) : (
        <p className="p-4 text-sm text-slate-500">
          {scene ? 'Çizim kayıtlı — düzenlemek için aç.' : 'Henüz çizim yok — Düzenle ile başla.'}
        </p>
      )}
    </div>
  );
}
