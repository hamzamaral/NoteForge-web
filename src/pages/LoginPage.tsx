import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/api';

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState('admin@noteforge.local');
  const [password, setPassword] = useState('Admin123!');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-sm"
      >
        <h1 className="font-display text-3xl font-bold tracking-tight">NoteForge</h1>
        <p className="mt-1 text-sm text-slate-600">
          Blok notlar · ilişkili işler · çizim
        </p>
        <label className="mt-6 block text-sm">
          E-posta
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="mt-3 block text-sm">
          Şifre
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white hover:bg-accentDark disabled:opacity-60"
        >
          Giriş yap
        </button>
        <p className="mt-4 text-center text-xs text-slate-500">
          Demo: admin@noteforge.local / Admin123!
        </p>
      </form>
    </div>
  );
}
