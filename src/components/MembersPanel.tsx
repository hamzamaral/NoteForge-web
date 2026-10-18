import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Member = {
  id: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  user: { id: string; email: string; fullName: string };
};

export function MembersPanel({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');

  const { data: members = [] } = useQuery({
    queryKey: ['members', workspaceId],
    enabled: open && !!workspaceId,
    queryFn: async () =>
      (await api.get<Member[]>(`/workspaces/${workspaceId}/members`)).data,
  });

  const me = members.find((m) => m.user.id === user?.id);
  const canInvite = me?.role === 'OWNER';

  const invite = useMutation({
    mutationFn: () =>
      api.post(`/workspaces/${workspaceId}/invite`, { email: email.trim(), role }),
    onSuccess: () => {
      setEmail('');
      void qc.invalidateQueries({ queryKey: ['members', workspaceId] });
      toast.success('Davet edildi');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['members', workspaceId] });
      toast.message('Üye çıkarıldı');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Workspace üyeleri</h2>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg bg-panel px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{m.user.fullName}</div>
                <div className="text-xs text-slate-500">
                  {m.user.email} · {m.role}
                </div>
              </div>
              {me?.role === 'OWNER' && m.role !== 'OWNER' && (
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => remove.mutate(m.user.id)}
                >
                  Çıkar
                </button>
              )}
            </li>
          ))}
        </ul>

        {canInvite && (
          <form
            className="mt-4 space-y-2 border-t pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) invite.mutate();
            }}
          >
            <p className="text-xs text-slate-500">
              Kullanıcı önce kayıt olmuş olmalı (API: POST /auth/register).
            </p>
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="e-posta"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <select
                className="rounded border px-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as 'EDITOR' | 'VIEWER')}
              >
                <option value="EDITOR">EDITOR</option>
                <option value="VIEWER">VIEWER</option>
              </select>
              <button type="submit" className="rounded bg-accent px-3 text-sm text-white">
                Davet et
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
