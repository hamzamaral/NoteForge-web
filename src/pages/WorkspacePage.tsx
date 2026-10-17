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

  usePageSync(pageId, user);

  useEffect(() => {
    if (!pageId && pages[0]) navigate(`/p/${pages[0].id}`, { replace: true });
  }, [pageId, pages, navigate]);

  const tree = useMemo(() => buildTree(pages), [pages]);

  const createPage = useMutation({
    mutationFn: (templateKey?: string) =>
      api.post('/pages', { workspaceId, templateKey }),
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
            onClick={() => createPage.mutate(undefined)}
          >
            + Yeni sayfa
          </button>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            onClick={() => createPage.mutate('meeting')}
          >
            Şablon: Toplantı
          </button>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            onClick={() => createPage.mutate('project')}
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
            <Link
              key={p.id}
              to={`/p/${p.id}`}
              className={`block rounded px-2 py-1 text-sm ${
                p.id === pageId ? 'bg-accent/10 text-accent' : 'hover:bg-panel'
              }`}
              style={{ paddingLeft: 8 + p.depth * 12 }}
            >
              {p.icon || '📄'} {p.title}
            </Link>
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
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  className="font-display min-w-0 flex-1 bg-transparent text-3xl font-bold outline-none"
                  value={page.title}
                  onChange={(e) => rename.mutate(e.target.value)}
                />
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

              {page.backlinks?.length > 0 && (
                <div className="mb-4 rounded-lg bg-panel px-3 py-2 text-sm">
                  <span className="font-medium">Backlink: </span>
                  {page.backlinks.map((b) => (
                    <Link key={b.fromPage.id} to={`/p/${b.fromPage.id}`} className="mr-2 text-accent underline">
                      {b.fromPage.title}
                    </Link>
                  ))}
                </div>
              )}

              {isDbPage ? (
                <DatabaseView pageId={page.id} />
              ) : (
                <>
                  <BlockEditor
                    blocks={page.blocks.filter((b) => b.type !== 'drawing')}
                    onChange={(payload) => saveBlocks.mutate(payload)}
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
          <TaskPanel workspaceId={workspaceId} pageId={pageId} />
        )}
      </main>
    </div>
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
