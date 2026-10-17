import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import axios from 'axios';

type Block = { type: string; props: Record<string, unknown> };

export function SharePage() {
  const { token } = useParams();
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

  if (isLoading) return <p className="p-8 text-slate-500">Yükleniyor…</p>;
  if (isError || !data) return <p className="p-8 text-slate-500">Paylaşım bulunamadı veya iptal edilmiş.</p>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          NoteForge · paylaşılan sayfa · {data.permission === 'READ' ? 'salt okunur' : data.permission}
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold">
          {data.page.icon ? `${data.page.icon} ` : ''}
          {data.page.title}
        </h1>
        <div className="prose prose-slate mt-8 max-w-none">
          {data.page.blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  const text = String(block.props.text ?? '');
  switch (block.type) {
    case 'heading':
      return (
        <h2 className={`font-display font-semibold ${Number(block.props.level) === 1 ? 'text-2xl' : 'text-xl'}`}>
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
      return <p className="text-sm text-slate-500 italic">[çizim bloğu — salt okunur önizleme yok]</p>;
    default:
      return <p>{text}</p>;
  }
}
