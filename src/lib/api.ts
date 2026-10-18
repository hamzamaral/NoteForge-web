import axios, { AxiosError } from 'axios';

const ACCESS = 'nf_access';
const REFRESH = 'nf_refresh';

export const api = axios.create({
  baseURL: '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config;
    if (error.response?.status !== 401 || !original || (original as { _retry?: boolean })._retry) {
      throw error;
    }
    (original as { _retry?: boolean })._retry = true;
    refreshing ??= (async () => {
      const refreshToken = localStorage.getItem(REFRESH);
      if (!refreshToken) return null;
      try {
        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        localStorage.setItem(ACCESS, data.accessToken);
        localStorage.setItem(REFRESH, data.refreshToken);
        return data.accessToken as string;
      } catch {
        localStorage.removeItem(ACCESS);
        localStorage.removeItem(REFRESH);
        return null;
      } finally {
        refreshing = null;
      }
    })();
    const token = await refreshing;
    if (!token) throw error;
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

export function getErrorMessage(e: unknown) {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data as { message?: string | string[] };
    if (Array.isArray(d?.message)) return d.message.join(', ');
    if (typeof d?.message === 'string') return d.message;
  }
  return e instanceof Error ? e.message : 'Hata';
}

export type User = {
  id: string;
  email: string;
  fullName: string;
  emailVerifiedAt?: string | null;
};
export type Workspace = {
  id: string;
  name: string;
  myRole?: 'OWNER' | 'EDITOR' | 'VIEWER' | null;
  members?: { role: string; user: User }[];
};
export type PageNode = {
  id: string;
  title: string;
  icon?: string | null;
  coverUrl?: string | null;
  parentId?: string | null;
  updatedAt: string;
  isFavorite?: boolean;
};
export type SearchHit = PageNode & {
  match: 'title' | 'content' | 'task' | 'comment' | 'db_row' | 'page';
  snippet: string | null;
  score: number;
  kind?: string;
};
export type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  sortOrder: number;
  parentBlockId?: string | null;
};
export type PageDetail = PageNode & {
  workspaceId: string;
  contentVersion: number;
  blocks: Block[];
  backlinks: { fromPage: { id: string; title: string } }[];
};
export type Task = {
  id: string;
  title: string;
  status: 'TODO' | 'DOING' | 'DONE';
  dueAt?: string | null;
  pageId?: string | null;
  assigneeId?: string | null;
};
