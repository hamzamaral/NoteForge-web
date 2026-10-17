import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  api,
  getErrorMessage,
  type PageDetail,
  type PageNode,
  type SearchHit,
  type Workspace,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BlockEditor } from '@/components/BlockEditor';
import { TaskPanel } from '@/components/TaskPanel';
import { DrawingBlock } from '@/components/DrawingBlock';
import { DatabaseView } from '@/components/DatabaseView';
import { TemplateGallery } from '@/components/TemplateGallery';
import { SharePanel } from '@/components/SharePanel';
import { MembersPanel } from '@/components/MembersPanel';
import { SearchPalette } from '@/components/SearchPalette';
import { NotificationBell } from '@/components/NotificationBell';
import { usePageSync } from '@/lib/sync';
import { docToBlocks } from '@/lib/blocks';
import { getRecents, pruneRecents, pushRecent, removeRecent } from '@/lib/recents';
import axios from 'axios';

export function WorkspacePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pageId } = useParams();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [recents, setRecents] = useState(() => getRecents());
  const [navOpen, setNavOpen] = useState(false);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const versionRef = useRef<number>(0);

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => (await api.get<Workspace[]>('/workspaces')).data,
  });
  const workspaceId = workspaces[0]?.id;
  const myRole = workspaces[0]?.myRole;
  const canEdit = myRole === 'OWNER' || myRole === 'EDITOR';

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () =>
      (await api.get<PageNode[]>(`/workspaces/${workspaceId}/pages`)).data,
  });

  const { data: trash = [] } = useQuery({
    queryKey: ['trash', workspaceId],
    enabled: !!workspaceId && showTrash,
    queryFn: async () =>
      (await api.get<PageNode[]>(`/workspaces/${workspaceId}/trash`)).data,
  });

  const { data: searchHits = [] } = useQuery({
    queryKey: ['search', workspaceId, q],
    enabled: !!workspaceId && q.trim().length > 1,
    queryFn: async () =>
      (
        await api.get<SearchHit[]>(`/workspaces/${workspaceId}/search`, {
          params: { q },
        })
      ).data,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const {
    data: page,
    isError: pageMissing,
    error: pageError,
  } = useQuery({
    queryKey: ['page', pageId],
    enabled: !!pageId,
    retry: false,
    queryFn: async () => (await api.get<PageDetail>(`/pages/${pageId}`)).data,
  });

  const { presence, status: syncStatus, provider } = usePageSync(
    page && pageId ? pageId : undefined,
    user,
  );

  useEffect(() => {
    if (!pageId && pages[0]) navigate(`/p/${pages[0].id}`, { replace: true });
  }, [pageId, pages, navigate]);

  // Drop deleted/trashed pages from "Son bakılanlar"
  useEffect(() => {
    if (!pages.length) return;
    setRecents(pruneRecents(pages.map((p) => p.id)));
  }, [pages]);

  useEffect(() => {
    if (page) {
      versionRef.current = page.contentVersion;
      pushRecent({ id: page.id, title: page.title });
      setRecents(getRecents());
    }
  }, [page?.id, page?.title, page?.contentVersion]);

  // Clicked a recent that was deleted → soft recover
  useEffect(() => {
    if (!pageId || !pageMissing) return;
    removeRecent(pageId);
    setRecents(getRecents());
    const msg = getErrorMessage(pageError);
    toast.message(msg === 'Sayfa bulunamadı' ? 'Bu sayfa silinmiş — listeden çıkarıldı' : msg);
    const fallback = pages.find((p) => p.id !== pageId)?.id;
    navigate(fallback ? `/p/${fallback}` : '/', { replace: true });
  }, [pageId, pageMissing, pageError, pages, navigate]);

  const tree = useMemo(() => buildTree(pages), [pages]);

  const createPage = useMutation({
    mutationFn: (opts?: { templateKey?: string; parentId?: string; title?: string }) =>
      api.post('/pages', { workspaceId, ...opts }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['pages'] });
      navigate(`/p/${res.data.id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const createDb = useMutation({
    mutationFn: (name: string) => api.post('/databases', { workspaceId, name }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['pages'] });
      navigate(`/p/${res.data.pageId}`);
      toast.success('Tablo sayfası açıldı (Postgres değil — uygulama içi)');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveBlocks = useMutation({
    mutationFn: (payload: ReturnType<typeof docToBlocks>) =>
      api.patch(`/pages/${pageId}/blocks`, {
        expectedVersion: versionRef.current,
        blocks: payload.blocks,
        links: payload.links,
      }),
    onSuccess: (res) => {
      versionRef.current = res.data.contentVersion;
      // Keep editor mounted; only refresh metadata/version in cache
      qc.setQueryData(['page', pageId], res.data);
    },
    onError: async (e) => {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        const fresh = await qc.fetchQuery({
          queryKey: ['page', pageId],
          queryFn: async () => (await api.get<PageDetail>(`/pages/${pageId}`)).data,
        });
        versionRef.current = fresh.contentVersion;
        toast.error('Kayıt çakışması — sürüm yenilendi, tekrar yazın');
        return;
      }
      toast.error(getErrorMessage(e));
    },
  });

  const rename = useMutation({
    mutationFn: (title: string) => api.patch(`/pages/${pageId}`, { title }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pages'] });
      void qc.invalidateQueries({ queryKey: ['page', pageId] });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: () =>
      api.patch(`/pages/${pageId}`, { isFavorite: !page?.isFavorite }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pages'] });
      void qc.invalidateQueries({ queryKey: ['page', pageId] });
    },
  });

  const importMd = useMutation({
    mutationFn: (markdown: string) =>
      api.post('/pages/import.md', { workspaceId, markdown }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['pages'] });
      navigate(`/p/${res.data.id}`);
      toast.success('Markdown içe aktarıldı');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const movePage = useMutation({
    mutationFn: (parentId: string | null) =>
      api.patch(`/pages/${pageId}`, { parentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pages'] });
      void qc.invalidateQueries({ queryKey: ['page', pageId] });
      toast.success('Sayfa taşındı');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const editorTodos = useMemo(() => {
    if (!page) return [];
    return page.blocks
      .filter((b) => b.type === 'todo')
      .map((b) => ({
        text: String(b.props.text || ''),
        checked: Boolean(b.props.checked),
      }));
  }, [page]);

  const childPages = useMemo(
    () => pages.filter((p) => p.parentId === pageId),
    [pages, pageId],
  );

  const trashPage = useMutation({
    mutationFn: () => api.delete(`/pages/${pageId}`),
    onSuccess: async () => {
      if (pageId) {
        removeRecent(pageId);
        setRecents(getRecents());
      }
      await qc.invalidateQueries({ queryKey: ['pages'] });
      await qc.removeQueries({ queryKey: ['page', pageId] });
      const next = pages.find((p) => p.id !== pageId)?.id;
      navigate(next ? `/p/${next}` : '/', { replace: true });
      toast.message('Çöp kutusuna taşındı');
    },
  });

  const exportMd = useMutation({
    mutationFn: async () => (await api.get(`/pages/${pageId}/export.md`)).data,
    onSuccess: (data: { title: string; markdown: string }) => {
      const blob = new Blob([data.markdown], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${data.title || 'page'}.md`;
      a.click();
    },
  });

  const drawingBlocks = (page?.blocks || []).filter((b) => b.type === 'drawing');

  const { data: dbForPage } = useQuery({
    queryKey: ['db-by-page', pageId],
    enabled: !!pageId,
    queryFn: async () =>
      (await api.get(`/databases/by-page/${pageId}`)).data as { id: string } | null,
  });
  const isDbPage = Boolean(dbForPage?.id);

  return (
    <div className="flex h-full min-h-screen">
      <button
        type="button"
        className="fixed left-3 top-3 z-40 rounded border bg-white px-2 py-1 text-xs shadow md:hidden"
        aria-label="Menüyü aç"
        onClick={() => setNavOpen(true)}
      >
        ☰
      </button>
      {navOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
          aria-label="Menüyü kapat"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white/95 transition-transform md:static md:z-0 md:w-64 md:max-w-none md:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-display text-lg font-bold">NoteForge</div>
            <NotificationBell />
          </div>
          <p className="truncate text-xs text-slate-500">
            {workspaces[0]?.name}
            {myRole ? ` · ${myRole}` : ''}
          </p>
          {!canEdit && (
            <p className="mt-1 text-[10px] text-amber-700" role="status">
              Salt okuma (VIEWER)
            </p>
          )}
        </div>
        <div className="space-y-1 p-2">
          <div className="flex gap-1">
            <input
              className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
              placeholder="Ara…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="button"
              className="shrink-0 rounded border px-2 py-1 text-[10px] text-slate-500 hover:bg-panel"
              title="Komut paleti (Ctrl+K)"
              onClick={() => setSearchOpen(true)}
            >
              ⌘K
            </button>
          </div>
          <button
            type="button"
            className="w-full rounded bg-accent px-2 py-1.5 text-left text-sm text-white disabled:opacity-50"
            disabled={!canEdit}
            onClick={() => createPage.mutate({})}
          >
            + Yeni sayfa
          </button>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            disabled={!pageId}
            onClick={() =>
              createPage.mutate({ parentId: pageId, title: 'Alt sayfa' })
            }
          >
            + Alt sayfa (bu sayfanın altında)
          </button>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            onClick={() => setGalleryOpen(true)}
          >
            Şablon galerisi…
          </button>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            onClick={() => mdInputRef.current?.click()}
          >
            MD içe aktar
          </button>
          <input
            ref={mdInputRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              importMd.mutate(text);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            title="Uygulama içi tablo sayfası ekler. Postgres’i silmez / değiştirmez."
            onClick={() => {
              const ok = window.confirm(
                'Tablo sayfası eklensin mi?\n\n' +
                  '• Bu, Notion’daki gibi satır + özellik + board sayfasıdır\n' +
                  '• Gerçek Postgres veritabanını SİLMEZ / oluşturmaz\n' +
                  '• İstersen sonra çöp kutusuna atabilirsin',
              );
              if (!ok) return;
              const name = window.prompt('Tablo sayfası adı', 'Proje listesi');
              if (name === null) return;
              createDb.mutate(name.trim() || 'Proje listesi');
            }}
          >
            Tablo sayfası ekle
          </button>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            onClick={() => setMembersOpen(true)}
          >
            Üyeler / davet
          </button>
        </div>
        {recents.length > 0 && (
          <div className="border-b px-2 pb-2">
            <p className="px-1 text-[10px] font-semibold uppercase text-slate-400">Son bakılanlar</p>
            {recents.slice(0, 5).map((r) => (
              <Link
                key={r.id}
                to={`/p/${r.id}`}
                className="block truncate rounded px-2 py-0.5 text-xs text-slate-600 hover:bg-panel"
              >
                {r.title}
              </Link>
            ))}
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {pages.some((p) => p.isFavorite) && (
            <div className="mb-2">
              <p className="px-1 text-[10px] font-semibold uppercase text-slate-400">Favoriler</p>
              {pages
                .filter((p) => p.isFavorite)
                .map((p) => (
                  <Link
                    key={p.id}
                    to={`/p/${p.id}`}
                    className="block truncate rounded px-2 py-1 text-sm hover:bg-panel"
                  >
                    ★ {p.title}
                  </Link>
                ))}
            </div>
          )}
          {q.trim().length > 1 ? (
            searchHits.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-slate-500">
                Sonuç yok — ⌘K ile gelişmiş ara
              </p>
            ) : (
              searchHits.map((p) => (
                <Link
                  key={p.id + p.match}
                  to={`/p/${p.id}`}
                  className={`block rounded px-2 py-1.5 hover:bg-panel ${
                    p.id === pageId ? 'bg-accent/10 text-accent' : ''
                  }`}
                >
                  <div className="truncate text-sm">
                    {p.icon || '📄'} {p.title}
                  </div>
                  {p.snippet && (
                    <p className="truncate pl-5 text-[10px] text-slate-500">{p.snippet}</p>
                  )}
                  <span className="pl-5 text-[9px] uppercase text-slate-400">{p.match}</span>
                </Link>
              ))
            )
          ) : (
            flattenTree(tree).map((p) => (
              <div
                key={p.id}
                className={`group flex items-center rounded ${
                  p.id === pageId ? 'bg-accent/10 text-accent' : 'hover:bg-panel'
                }`}
                style={{ paddingLeft: 4 + p.depth * 12 }}
              >
                <Link to={`/p/${p.id}`} className="min-w-0 flex-1 truncate px-2 py-1 text-sm">
                  {p.icon || '📄'} {p.title}
                </Link>
                <button
                  type="button"
                  title="Alt sayfa ekle"
                  className="mr-1 hidden rounded px-1 text-xs text-slate-400 group-hover:inline hover:text-accent"
                  onClick={() =>
                    createPage.mutate({ parentId: p.id, title: 'Alt sayfa' })
                  }
                >
                  +
                </button>
              </div>
            ))
          )}
        </nav>
        <div className="border-t p-2 text-xs">
          <button type="button" className="text-slate-600 underline" onClick={() => setShowTrash((v) => !v)}>
            Çöp kutusu
          </button>
          {showTrash &&
            trash.map((p) => (
              <button
                key={p.id}
                type="button"
                className="mt-1 block w-full text-left hover:underline"
                onClick={async () => {
                  await api.post(`/pages/${p.id}/restore`);
                  void qc.invalidateQueries({ queryKey: ['pages'] });
                  void qc.invalidateQueries({ queryKey: ['trash'] });
                }}
              >
                Geri al: {p.title}
              </button>
            ))}
          <div className="mt-2 flex items-center justify-between">
            <span className="truncate">{user?.fullName}</span>
            <button type="button" onClick={() => void logout()}>
              Çıkış
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-6 md:p-10">
          {page ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Breadcrumb pages={pages} pageId={page.id} />
                <span className="ml-auto flex items-center gap-2" aria-live="polite">
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px]"
                    title="Socket.IO /sync + Yjs"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        syncStatus === 'synced'
                          ? 'bg-emerald-500'
                          : syncStatus === 'connected' || syncStatus === 'connecting'
                            ? 'bg-amber-400'
                            : syncStatus === 'error'
                              ? 'bg-red-500'
                              : 'bg-slate-300'
                      }`}
                    />
                    {syncStatus === 'synced'
                      ? 'Canlı'
                      : syncStatus === 'connecting'
                        ? 'Bağlanıyor…'
                        : syncStatus === 'connected'
                          ? 'Senkron…'
                          : syncStatus === 'error'
                            ? 'Sync hata'
                            : 'Çevrimdışı'}
                  </span>
                  <span aria-live="polite" aria-atomic="true">
                    {saveState === 'saving' && 'Kaydediliyor…'}
                    {saveState === 'saved' && 'Kaydedildi'}
                    {saveState === 'error' && (
                      <span className="text-red-600">Kayıt başarısız</span>
                    )}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  {presence.map((p) => (
                    <span
                      key={(p.socketId || p.userId) + p.color}
                      title={`${p.name}${p.userId === user?.id ? ' (sen)' : ''}`}
                      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ring-2 ring-white"
                      style={{ background: p.color }}
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  className="font-display min-w-0 flex-1 bg-transparent text-3xl font-bold outline-none"
                  value={page.title}
                  onChange={(e) => rename.mutate(e.target.value)}
                />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  Üst sayfa
                  <select
                    className="max-w-[180px] rounded border px-1 py-1 text-xs text-ink"
                    value={page.parentId ?? ''}
                    onChange={(e) =>
                      movePage.mutate(e.target.value ? e.target.value : null)
                    }
                  >
                    <option value="">(kök)</option>
                    {pages
                      .filter((p) => p.id !== page.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  title="Favori"
                  onClick={() => toggleFavorite.mutate()}
                >
                  {page.isFavorite ? '★ Favori' : '☆ Favori'}
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => setShareOpen(true)}
                >
                  Paylaş
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  disabled={!canEdit}
                  onClick={() => setHistoryOpen(true)}
                >
                  Geçmiş
                </button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => exportMd.mutate()}>
                  MD dışa aktar
                </button>
                {myRole === 'OWNER' && workspaceId && (
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    onClick={async () => {
                      try {
                        const res = await api.get(`/admin/workspaces/${workspaceId}/export.zip`, {
                          responseType: 'blob',
                        });
                        const url = URL.createObjectURL(res.data);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `noteforge-export.zip`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Workspace ZIP indirildi');
                      } catch (e) {
                        toast.error(getErrorMessage(e));
                      }
                    }}
                  >
                    ZIP export
                  </button>
                )}
                <button type="button" className="rounded border px-2 py-1 text-xs text-red-600" onClick={() => trashPage.mutate()}>
                  Sil
                </button>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-panel px-3 py-2 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Backlink · buraya bağlananlar
                  </p>
                  {page.backlinks?.length ? (
                    <ul className="mt-1 space-y-0.5">
                      {page.backlinks.map((b) => (
                        <li key={b.fromPage.id}>
                          <Link to={`/p/${b.fromPage.id}`} className="text-accent underline">
                            {b.fromPage.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      Henüz yok. Başka sayfada <code className="text-[10px]">@</code> ile bu sayfayı
                      mention et.
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-panel px-3 py-2 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Alt sayfalar
                  </p>
                  {childPages.length ? (
                    <ul className="mt-1 space-y-0.5">
                      {childPages.map((c) => (
                        <li key={c.id}>
                          <Link to={`/p/${c.id}`} className="text-accent underline">
                            {c.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      Yok — sidebar’dan “Alt sayfa” veya satırdaki + ile ekle.
                    </p>
                  )}
                </div>
              </div>

              {isDbPage ? (
                <DatabaseView pageId={page.id} />
              ) : (
                <>
                  <BlockEditor
                    key={page.id}
                    blocks={page.blocks.filter((b) => b.type !== 'drawing')}
                    pages={pages}
                    currentPageId={page.id}
                    workspaceId={workspaceId}
                    provider={provider}
                    readOnly={!canEdit}
                    onChange={(payload) => {
                      // Editor doesn't own drawing blocks — merge them back so autosave
                      // doesn't wipe Excalidraw scenes.
                      const drawings = page.blocks.filter((b) => b.type === 'drawing');
                      const base = payload.blocks.length;
                      return saveBlocks.mutateAsync({
                        blocks: [
                          ...payload.blocks,
                          ...drawings.map((d, i) => ({
                            id: d.id,
                            type: d.type,
                            props: d.props,
                            sortOrder: base + i + 1,
                          })),
                        ],
                        links: payload.links,
                      });
                    }}
                    onSaveState={setSaveState}
                  />
                  {drawingBlocks.map((b) => (
                    <DrawingBlock
                      key={b.id}
                      title={`Çizim · ${String(b.props.sceneId || b.id).slice(0, 8)}`}
                      initialData={b.props.scene}
                      onSave={(scene) => {
                        const next = page.blocks.map((x) =>
                          x.id === b.id ? { ...x, props: { ...x.props, scene } } : x,
                        );
                        saveBlocks.mutate({
                          blocks: next.map((x, i) => ({
                            id: x.id,
                            type: x.type,
                            props: x.props,
                            sortOrder: i + 1,
                          })),
                          links: [],
                        });
                      }}
                      onRemove={() => {
                        const next = page.blocks.filter((x) => x.id !== b.id);
                        saveBlocks.mutate({
                          blocks: next.map((x, i) => ({
                            id: x.id,
                            type: x.type,
                            props: x.props,
                            sortOrder: i + 1,
                          })),
                          links: [],
                        });
                      }}
                    />
                  ))}
                  <Comments
                    pageId={page.id}
                    currentUserId={user?.id}
                    blocks={page.blocks}
                  />
                </>
              )}
            </>
          ) : (
            <p className="text-slate-500">Sayfa seçin veya oluşturun.</p>
          )}
        </div>
        <SearchPalette
          open={searchOpen}
          workspaceId={workspaceId}
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => navigate(`/p/${id}`)}
        />
        <TemplateGallery
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          onPick={(key) => createPage.mutate({ templateKey: key })}
        />
        {pageId && (
          <SharePanel pageId={pageId} open={shareOpen} onClose={() => setShareOpen(false)} />
        )}
        {workspaceId && (
          <MembersPanel
            workspaceId={workspaceId}
            open={membersOpen}
            onClose={() => setMembersOpen(false)}
          />
        )}
        {workspaceId && pageId && !isDbPage && (
          <TaskPanel
            workspaceId={workspaceId}
            pageId={pageId}
            seedTodos={editorTodos}
            currentUserId={user?.id}
            members={(workspaces[0]?.members || []).map((m) => ({
              id: m.user.id,
              fullName: m.user.fullName,
            }))}
          />
        )}
        {historyOpen && pageId && (
          <HistoryModal
            pageId={pageId}
            onClose={() => setHistoryOpen(false)}
            onRestored={() => {
              setHistoryOpen(false);
              void qc.invalidateQueries({ queryKey: ['page', pageId] });
            }}
          />
        )}
      </main>
    </div>
  );
}

function HistoryModal({
  pageId,
  onClose,
  onRestored,
}: {
  pageId: string;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { data: snaps = [], isLoading } = useQuery({
    queryKey: ['snapshots', pageId],
    queryFn: async () =>
      (
        await api.get<{ id: string; version: number; title: string; createdAt: string }[]>(
          `/pages/${pageId}/snapshots`,
        )
      ).data,
  });
  const restore = useMutation({
    mutationFn: (snapshotId: string) =>
      api.post(`/pages/${pageId}/snapshots/${snapshotId}/restore`),
    onSuccess: () => {
      toast.success('Sürüm geri yüklendi');
      onRestored();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-xl border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Sayfa geçmişi"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Geçmiş</h2>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            Kapat
          </button>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {isLoading && <li className="p-3 text-sm text-slate-500">Yükleniyor…</li>}
          {!isLoading && !snaps.length && (
            <li className="p-3 text-sm text-slate-500">Henüz snapshot yok</li>
          )}
          {snaps.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-panel"
            >
              <div>
                <p className="text-sm font-medium">v{s.version} · {s.title}</p>
                <p className="text-[11px] text-slate-500">
                  {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs text-accent"
                onClick={() => restore.mutate(s.id)}
              >
                Geri al
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Breadcrumb({ pages, pageId }: { pages: PageNode[]; pageId: string }) {
  const chain: PageNode[] = [];
  let cur: PageNode | undefined = pages.find((p) => p.id === pageId);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    chain.unshift(cur);
    guard.add(cur.id);
    cur = cur.parentId ? pages.find((p) => p.id === cur!.parentId) : undefined;
  }
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {chain.map((p, i) => (
        <span key={p.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-slate-300">/</span>}
          <Link to={`/p/${p.id}`} className="hover:text-accent hover:underline">
            {p.title}
          </Link>
        </span>
      ))}
    </nav>
  );
}

function blockLabel(b: { type: string; props: Record<string, unknown> }, index: number) {
  const TYPE: Record<string, string> = {
    heading: 'Başlık',
    paragraph: 'Paragraf',
    bullet: 'Madde',
    todo: 'Yapılacak',
    quote: 'Alıntı',
    code: 'Kod',
    divider: 'Ayırıcı',
    image: 'Görsel',
    drawing: 'Çizim',
  };
  const kind = TYPE[b.type] || 'Blok';
  const raw = String(b.props.text ?? b.props.alt ?? '').replace(/\s+/g, ' ').trim();
  if (raw) return `${kind}: ${raw.slice(0, 56)}${raw.length > 56 ? '…' : ''}`;
  if (b.type === 'image') return `${kind} ${index + 1}`;
  if (b.type === 'drawing') return `${kind} ${index + 1}`;
  if (b.type === 'divider') return `${kind}`;
  return `${kind} ${index + 1} (boş)`;
}

function Comments({
  pageId,
  currentUserId,
  blocks,
}: {
  pageId: string;
  currentUserId?: string;
  blocks: { id: string; type: string; props: Record<string, unknown> }[];
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [blockId, setBlockId] = useState('');
  const { data: comments = [] } = useQuery({
    queryKey: ['comments', pageId],
    queryFn: async () =>
      (
        await api.get<
          {
            id: string;
            body: string;
            blockId?: string | null;
            createdAt: string;
            author: { id: string; fullName: string };
          }[]
        >(`/pages/${pageId}/comments`)
      ).data,
  });

  const commentable = blocks.filter((b) => b.type !== 'divider');

  return (
    <section className="mt-10 border-t pt-4">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        Yorumlar · {comments.length}
      </h3>
      <ul className="mt-2 space-y-2">
        {comments.map((c) => {
          const bi = commentable.findIndex((b) => b.id === c.blockId);
          const blk = bi >= 0 ? commentable[bi] : blocks.find((b) => b.id === c.blockId);
          return (
            <li key={c.id} className="rounded-lg border bg-white/80 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium">{c.author.fullName}</span>
                  <span className="ml-2 text-[10px] text-slate-400">
                    {new Date(c.createdAt).toLocaleString('tr-TR')}
                  </span>
                  {c.blockId && blk && (
                    <span className="ml-2 text-[10px] text-accent">
                      → {blockLabel(blk, bi >= 0 ? bi : 0)}
                    </span>
                  )}
                  <p className="mt-0.5">{c.body}</p>
                </div>
                {c.author.id === currentUserId && (
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={async () => {
                      await api.delete(`/pages/${pageId}/comments/${c.id}`);
                      void qc.invalidateQueries({ queryKey: ['comments', pageId] });
                    }}
                  >
                    Sil
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!comments.length && (
          <li className="text-xs text-slate-500">Henüz yorum yok.</li>
        )}
      </ul>
      <form
        className="mt-3 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          await api.post(`/pages/${pageId}/comments`, {
            body,
            blockId: blockId || undefined,
          });
          setBody('');
          setBlockId('');
          void qc.invalidateQueries({ queryKey: ['comments', pageId] });
        }}
      >
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Yorum nereye?
        </label>
        <select
          className="w-full rounded border px-2 py-1.5 text-sm"
          value={blockId}
          onChange={(e) => setBlockId(e.target.value)}
        >
          <option value="">Tüm sayfa</option>
          {commentable.map((b, i) => (
            <option key={b.id} value={b.id}>
              {blockLabel(b, i)}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-2 py-1 text-sm"
            placeholder="Yorum yaz…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="submit" className="rounded bg-accent px-3 text-sm text-white">
            Gönder
          </button>
        </div>
      </form>
    </section>
  );
}

type TreeNode = PageNode & { children: TreeNode[]; depth?: number };

function buildTree(pages: PageNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  pages.forEach((p) => map.set(p.id, { ...p, children: [] }));
  const roots: TreeNode[] = [];
  for (const p of map.values()) {
    if (p.parentId && map.has(p.parentId)) map.get(p.parentId)!.children.push(p);
    else roots.push(p);
  }
  return roots;
}

function flattenTree(nodes: TreeNode[], depth = 0): (PageNode & { depth: number })[] {
  const out: (PageNode & { depth: number })[] = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}
