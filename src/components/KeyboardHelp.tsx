export function KeyboardHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-900/40 px-4 pb-8 sm:items-center sm:pb-0"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Klavye kısayolları"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Klavye</h2>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            Esc
          </button>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between gap-4">
            <span>Komut paleti</span>
            <kbd className="rounded border bg-panel px-1.5 text-[11px]">Ctrl+K</kbd>
          </li>
          <li className="flex justify-between gap-4">
            <span>Slash komutlar</span>
            <kbd className="rounded border bg-panel px-1.5 text-[11px]">/</kbd>
          </li>
          <li className="flex justify-between gap-4">
            <span>Sayfa mention</span>
            <kbd className="rounded border bg-panel px-1.5 text-[11px]">@</kbd>
          </li>
          <li className="flex justify-between gap-4">
            <span>Bu yardım</span>
            <kbd className="rounded border bg-panel px-1.5 text-[11px]">?</kbd>
          </li>
        </ul>
      </div>
    </div>
  );
}
