const KEY = 'nf_recent_pages';

export function pushRecent(page: { id: string; title: string }) {
  try {
    const prev = getRecents().filter((p) => p.id !== page.id);
    const next = [{ id: page.id, title: page.title, at: Date.now() }, ...prev].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getRecents(): { id: string; title: string; at: number }[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
