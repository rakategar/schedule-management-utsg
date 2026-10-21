import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, AlertTriangle, KeyRound, Send } from 'lucide-react';
import { call, auth } from '../lib/api';
import type { Session, User } from '../lib/types';

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="login">
      <div className="login-bg" aria-hidden />
      <div className="login-shade" aria-hidden />
      <div className="login-inner">{children}</div>
      <div className="login-foot">© {new Date().getFullYear()} PT United Tractors Semen Gresik · Dashboard Reminder</div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, autoComplete, id }: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string; id: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="login-input">
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required />
      <button type="button" className="eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={show}>
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

export function LoginPage({ onLogin, linkingTelegram }: { onLogin: (s: Session) => void; linkingTelegram?: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const s = await call<Session>('auth.login', { username, password });
      auth.setToken(s.token);
      onLogin(s);
    } catch (ex) {
      setErr((ex as Error).message);
      setShake(true); setTimeout(() => setShake(false), 300);
      setBusy(false);
    }
  };

  return (
    <LoginShell>
      <form className={`login-card ${shake ? 'shake' : ''}`} onSubmit={submit} noValidate>
        <img className="logo" src="/logo-usg.png" alt="UTSG" width={150} height={69} />
        <div className="title">Dashboard Reminder</div>
        {linkingTelegram && <div className="alert alert-info"><Send />Masuk dengan akun dashboard untuk menghubungkan akun Telegram kamu.</div>}
        <div className="login-input">
          <label htmlFor="u" className="sr-only">Username</label>
          <input id="u" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
        </div>
        <PasswordInput id="p" value={password} onChange={setPassword} placeholder="Password" autoComplete="current-password" />
        <div className="login-hint">Klik ikon mata untuk menampilkan password</div>
        {err && <div className="alert alert-error" role="alert"><AlertTriangle />{err}</div>}
        <button className="login-btn" disabled={busy || !username || !password}>
          {busy ? <><Loader2 className="spin" size={18} />Memeriksa…</> : 'Sign In'}
        </button>
      </form>
    </LoginShell>
  );
}

/** Wajib ganti password saat login pertama (setelah broadcast / reset oleh superadmin) */
export function ForceResetPage({ user, onDone, onLogout }: { user: User; onDone: (u: User) => void; onLogout: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== again) { setErr('Konfirmasi password baru tidak sama.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await call<{ user: User }>('auth.changePassword', { currentPassword: cur, newPassword: next });
      onDone(r.user);
    } catch (ex) { setErr((ex as Error).message); setBusy(false); }
  };

  return (
    <LoginShell>
      <form className="login-card" onSubmit={submit}>
        <img className="logo" src="/logo-usg.png" alt="UTSG" width={150} height={69} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 17 }}><KeyRound size={18} />Buat password baru</div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#5A6673' }}>Halo {user.fullName || user.username}. Demi keamanan, ganti password sementara dari email sebelum melanjutkan.</p>
        </div>
        <PasswordInput id="c" value={cur} onChange={setCur} placeholder="Password sementara (dari email)" autoComplete="current-password" />
        <PasswordInput id="n" value={next} onChange={setNext} placeholder="Password baru" autoComplete="new-password" />
        <PasswordInput id="a" value={again} onChange={setAgain} placeholder="Ulangi password baru" autoComplete="new-password" />
        <div className="login-hint">Minimal 8 karakter, berisi huruf dan angka.</div>
        {err && <div className="alert alert-error" role="alert"><AlertTriangle />{err}</div>}
        <button className="login-btn" disabled={busy || !cur || !next || !again}>{busy ? <><Loader2 className="spin" size={18} />Menyimpan…</> : 'Simpan & lanjutkan'}</button>
        <button type="button" onClick={onLogout} style={{ border: 0, background: 'none', color: '#5A6673', cursor: 'pointer', fontSize: 13 }}>Keluar</button>
      </form>
    </LoginShell>
  );
}
