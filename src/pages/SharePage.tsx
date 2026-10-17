import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useState } from 'react';
import { toast } from 'sonner';

type Block = { type: string; props: Record<string, unknown> };

export function SharePage() {
  const { token } = useParams();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [guestName, setGuestName] = useState('');

  const { data, isError, isLoading } = useQuery({
    queryKey: ['share', token],
    queryFn: async () =>
      (
        await axios.get(`/api/v1/public/${token}`)
      ).data as {
        permission: string;
        page: { title: string; icon?: string; blocks: Block[] };
      },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['share-comments', token],
    enabled: !!token && data?.permission === 'COMMENT',
    queryFn: async () =>
      (
        await axios.get(`/api/v1/public/${token}/comments`)
      ).data as { id: string; body: string; author: { fullName: string }; createdAt: string }[],
  });

  const postComment = useMutation({
    mutationFn: () =>
      axios.post(`/api/v1/public/${token}/comments`, { body, guestName: guestName || undefined }),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({ queryKey: ['share-comments', token] });
      toast.success('Yorum eklendi');
    },
    onError: () => toast.error('Yorum eklenemedi'),
  });

  if (isLoading) return <p className="p-8 text-slate-500">Yükleniyor…</p>;
  if (isError || !data) return <p className="p-8 text-slate-500">Paylaşım bulunamadı veya iptal edilmiş.</p>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          NoteForge · paylaşılan sayfa ·{' '}
          {data.permission === 'READ' ? 'salt okunur' : 'yorum açık'}
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold sm:text-3xl">
          {data.page.icon ? `${data.page.icon} ` : ''}
          {data.page.title}
        </h1>
        <div className="prose prose-slate mt-8 max-w-none">
          {data.page.blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </div>

        {data.permission === 'COMMENT' && (
          <section className="mt-10 border-t pt-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Yorumlar</h2>
            <ul className="mt-2 space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded border bg-white/80 px-3 py-2 text-sm">
                  <span className="font-medium">{c.author.fullName}</span>
                  <p>{c.body}</p>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (body.trim()) postComment.mutate();
              }}
            >
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="Adınız (opsiyonel)"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
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
        )}
      </div>
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  const text = String(block.props.text ?? '');
  switch (block.type) {
    case 'heading':
      return (
        <h2
          className={`font-display font-semibold ${Number(block.props.level) === 1 ? 'text-2xl' : 'text-xl'}`}
        >
          {text}
        </h2>
      );
    case 'bullet':
      return <li className="ml-4 list-disc">{text}</li>;
    case 'todo':
      return (
        <p>
          <input type="checkbox" checked={Boolean(block.props.checked)} readOnly className="mr-2" />
          {text}
        </p>
      );
    case 'quote':
      return <blockquote className="border-l-4 border-accent/40 pl-3 italic">{text}</blockquote>;
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100">{text}</pre>
      );
    case 'callout':
      return (
        <div className="my-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">{text}</div>
      );
    case 'divider':
      return <hr className="my-4 border-slate-200" />;
    case 'image':
      return (
        <img
          src={String(block.props.src || '')}
          alt={String(block.props.alt || '')}
          className="max-w-full rounded-lg"
        />
      );
    case 'drawing':
      return (
        <p className="text-sm italic text-slate-500">
          [çizim — {String(block.props.sceneId || 'sahne')}]
        </p>
      );
    default:
      return <p>{text}</p>;
  }
}
