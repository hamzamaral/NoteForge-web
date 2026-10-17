import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import axios from 'axios';

export function SharePage() {
  const { token } = useParams();
  const { data, isError, isLoading } = useQuery({
    queryKey: ['share', token],
    queryFn: async () =>
      (await axios.get(`/api/v1/public/${token}`)).data as {
        page: { title: string; blocks: { type: string; props: { text?: string } }[] };
      },
  });

  if (isLoading) return <p className="p-8">Yükleniyor…</p>;
  if (isError || !data) return <p className="p-8">Paylaşım bulunamadı.</p>;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <p className="text-xs uppercase tracking-wide text-slate-500">NoteForge · salt okunur</p>
      <h1 className="font-display mt-2 text-3xl font-bold">{data.page.title}</h1>
      <div className="mt-6 space-y-2">
        {data.page.blocks.map((b, i) => (
          <p key={i} className="text-slate-800">
            {b.type === 'heading' ? (
              <strong>{String(b.props.text || '')}</strong>
            ) : (
              String(b.props.text || '')
            )}
          </p>
        ))}
      </div>
    </div>
  );
}
