import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage, type PageDetail, type PageNode, type Workspace } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BlockEditor } from '@/components/BlockEditor';
import { TaskPanel } from '@/components/TaskPanel';
import { DrawingBlock } from '@/components/DrawingBlock';
import { DatabaseView } from '@/components/DatabaseView';
import { usePageSync } from '@/lib/sync';
import { docToBlocks } from '@/lib/blocks';

export function WorkspacePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pageId } = useParams();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => (await api.get<Workspace[]>('/workspaces')).data,
  });
  const workspaceId = workspaces[0]?.id;

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
        await api.get<PageNode[]>(`/workspaces/${workspaceId}/search`, {
          params: { q },
        })
      ).data,
  });

  const { data: page } = useQuery({
    queryKey: ['page', pageId],
    enabled: !!pageId,
    queryFn: async () => (await api.get<PageDetail>(`/pages/${pageId}`)).data,
  });

  const { presence } = usePageSync(pageId, user);

  useEffect(() => {
    if (!pageId && pages[0]) navigate(`/p/${pages[0].id}`, { replace: true });
  }, [pageId, pages, navigate]);

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
    mutationFn: () => api.post('/databases', { workspaceId, name: 'Yeni DB' }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['pages'] });
      navigate(`/p/${res.data.pageId}`);
      toast.success('Veritabanı oluşturuldu');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveBlocks = useMutation({
    mutationFn: (payload: ReturnType<typeof docToBlocks>) =>
      api.patch(`/pages/${pageId}/blocks`, {
        expectedVersion: page!.contentVersion,
        blocks: payload.blocks,
        links: payload.links,
      }),
    onSuccess: (res) => {
      qc.setQueryData(['page', pageId], res.data);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const rename = useMutation({
    mutationFn: (title: string) => api.patch(`/pages/${pageId}`, { title }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pages'] });
      void qc.invalidateQueries({ queryKey: ['page', pageId] });
    },
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
      await qc.invalidateQueries({ queryKey: ['pages'] });
      navigate('/');
      toast.message('Çöp kutusuna taşındı');
    },
  });

  const share = useMutation({
    mutationFn: () => api.post('/shares', { pageId }),
    onSuccess: (res) => {
      const url = `${window.location.origin}/share/${res.data.token}`;
      void navigator.clipboard.writeText(url);
      toast.success('Paylaşım linki kopyalandı');
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
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white/80">
        <div className="border-b px-3 py-3">
          <div className="font-display text-lg font-bold">NoteForge</div>
          <p className="truncate text-xs text-slate-500">{workspaces[0]?.name}</p>
        </div>
        <div className="space-y-1 p-2">
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            className="w-full rounded bg-accent px-2 py-1.5 text-left text-sm text-white"
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
            onClick={() => createPage.mutate({ templateKey: 'meeting' })}
          >
            Şablon: Toplantı
          </button>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            onClick={() => createPage.mutate({ templateKey: 'project' })}
          >
            Şablon: Proje
          </button>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            onClick={() => createDb.mutate()}
          >
            Veritabanı oluştur
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {(q.trim().length > 1
            ? searchHits.map((p) => ({ ...p, depth: 0 }))
            : flattenTree(tree)
          ).map((p) => (
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
          ))}
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
                <span className="ml-auto">
                  {saveState === 'saving' && 'Kaydediliyor…'}
                  {saveState === 'saved' && 'Kaydedildi'}
                </span>
                {presence.length > 0 && (
                  <div className="flex items-center gap-1">
                    {presence.map((p) => (
                      <span
                        key={p.userId + p.color}
                        title={p.name}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ background: p.color }}
                      >
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
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
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => share.mutate()}>
                  Paylaş
                </button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => exportMd.mutate()}>
                  MD dışa aktar
                </button>
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
                    blocks={page.blocks.filter((b) => b.type !== 'drawing')}
                    pages={pages}
                    currentPageId={page.id}
                    onChange={(payload) => saveBlocks.mutate(payload)}
                    onSaveState={setSaveState}
                  />
                  {drawingBlocks.map((b) => (
                    <DrawingBlock
                      key={b.id}
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
                    />
                  ))}
                  <Comments pageId={page.id} />
                </>
              )}
            </>
          ) : (
            <p className="text-slate-500">Sayfa seçin veya oluşturun.</p>
          )}
        </div>
        {workspaceId && pageId && !isDbPage && (
          <TaskPanel
            workspaceId={workspaceId}
            pageId={pageId}
            seedTodos={editorTodos}
          />
        )}
      </main>
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

function Comments({ pageId }: { pageId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const { data: comments = [] } = useQuery({
    queryKey: ['comments', pageId],
    queryFn: async () =>
      (await api.get<{ id: string; body: string; author: { fullName: string } }[]>(`/pages/${pageId}/comments`))
        .data,
  });
  return (
    <section className="mt-10 border-t pt-4">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Yorumlar</h3>
      <ul className="mt-2 space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg bg-white/80 px-3 py-2 text-sm">
            <span className="font-medium">{c.author.fullName}: </span>
            {c.body}
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          await api.post(`/pages/${pageId}/comments`, { body });
          setBody('');
          void qc.invalidateQueries({ queryKey: ['comments', pageId] });
        }}
      >
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          placeholder="Yorum yaz…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" className="rounded bg-accent px-3 text-sm text-white">
          Gönder
        </button>
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
