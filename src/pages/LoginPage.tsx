import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { api, getErrorMessage } from '@/lib/api';

export function LoginPage() {
  const { user, login, register, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('admin@noteforge.local');
  const [password, setPassword] = useState('Admin123!');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await api.post('/auth/password/forgot', { email });
        toast.success('Reset token sunucu logunda (dev)');
      } else if (mode === 'register') {
        await register(email, password, fullName || email.split('@')[0]);
        toast.success('Hesap oluşturuldu');
      } else {
        await login(email, password);
      }
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
          {mode === 'register' ? 'Yeni hesap' : mode === 'forgot' ? 'Şifre sıfırla' : 'Giriş'}
        </p>
        {mode === 'register' && (
          <label className="mt-6 block text-sm">
            Ad
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
        )}
        <label className={`block text-sm ${mode === 'register' ? 'mt-3' : 'mt-6'}`}>
          E-posta
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        {mode !== 'forgot' && (
          <label className="mt-3 block text-sm">
            Şifre
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white hover:bg-accentDark disabled:opacity-60"
        >
          {mode === 'register' ? 'Kayıt ol' : mode === 'forgot' ? 'Link iste' : 'Giriş yap'}
        </button>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-slate-500">
          {mode !== 'login' && (
            <button type="button" className="underline" onClick={() => setMode('login')}>
              Giriş
            </button>
          )}
          {mode !== 'register' && (
            <button type="button" className="underline" onClick={() => setMode('register')}>
              Kayıt ol
            </button>
          )}
          {mode !== 'forgot' && (
            <button type="button" className="underline" onClick={() => setMode('forgot')}>
              Şifremi unuttum
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Demo: admin@noteforge.local / Admin123! ·{' '}
          <Link to="/share/demo" className="underline">
            paylaşım
          </Link>
        </p>
      </form>
    </div>
  );
}
