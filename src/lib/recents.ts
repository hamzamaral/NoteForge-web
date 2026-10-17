const KEY = 'nf_recent_pages';

export type RecentPage = { id: string; title: string; at: number };

export function pushRecent(page: { id: string; title: string }) {
  try {
    const prev = getRecents().filter((p) => p.id !== page.id);
    const next: RecentPage[] = [
      { id: page.id, title: page.title, at: Date.now() },
      ...prev,
    ].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getRecents(): RecentPage[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as RecentPage[];
  } catch {
    return [];
  }
}

export function removeRecent(id: string) {
  try {
    const next = getRecents().filter((p) => p.id !== id);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Keep only pages that still exist in the live workspace tree */
export function pruneRecents(aliveIds: Set<string> | string[]) {
  try {
    const alive = aliveIds instanceof Set ? aliveIds : new Set(aliveIds);
    const next = getRecents().filter((p) => alive.has(p.id));
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return getRecents();
  }
}
