import { useState, type FormEvent } from 'react';
import { Moon, Sun } from 'lucide-react';
import { call } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import type { User } from '../lib/types';
import { useSession } from '../session';
import { Badge, ErrorBox, Switch, useToast } from '../components/ui';
import { TelegramCard } from './TelegramLink';

export function ProfilePage({ dark, toggleTheme }: { dark: boolean; toggleTheme: () => void }) {
  const { user, setUser, isSuper } = useSession();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (next !== again) return setErr('Konfirmasi password baru tidak sama.');
    setBusy(true);
    try {
      const r = await call<{ user: User }>('auth.changePassword', { currentPassword: cur, newPassword: next });
      setUser(r.user); setCur(''); setNext(''); setAgain('');
      toast('Password diganti');
    } catch (ex) { setErr((ex as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <div className="page-head"><div><h1>Profil</h1><div className="sub">Data akun dan keamanan login Anda.</div></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="panel panel-pad stack">
          <h2>Akun</h2>
          <dl className="kv">
            <dt>Nama</dt><dd>{user.fullName || '—'}</dd>
            <dt>Username</dt><dd className="num">{user.username}</dd>
            <dt>Email</dt><dd>{user.email || '—'}</dd>
            <dt>Peran</dt><dd>{isSuper ? <Badge tone="admin">Superadmin</Badge> : <Badge tone="brand">User</Badge>}</dd>
            {!isSuper && <><dt>Divisi</dt><dd>{user.divisionName}</dd></>}
            <dt>Login terakhir</dt><dd>{fmtDateTime(user.lastLoginAt)}</dd>
            <dt>Ganti password</dt><dd>{fmtDateTime(user.passwordChangedAt)}</dd>
          </dl>
          <div className="group">
            <div className="row">{dark ? <Moon size={16} /> : <Sun size={16} />}<span className="grow">Mode gelap</span><Switch checked={dark} onChange={toggleTheme} label="Mode gelap" /></div>
          </div>
        </div>
        <form className="panel panel-pad stack" onSubmit={submit}>
          <h2>Reset password</h2>
          <div className="field"><label className="req" htmlFor="pc">Password saat ini</label><input id="pc" type="password" className="input" value={cur} onChange={e => setCur(e.target.value)} autoComplete="current-password" /></div>
          <div className="field"><label className="req" htmlFor="pn">Password baru</label><input id="pn" type="password" className="input" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
            <div className="help">Minimal 8 karakter, berisi huruf dan angka.</div></div>
          <div className="field"><label className="req" htmlFor="pa">Ulangi password baru</label><input id="pa" type="password" className="input" value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" /></div>
          {err && <ErrorBox>{err}</ErrorBox>}
          <div><button className="btn btn-primary" disabled={busy || !cur || !next || !again}>{busy ? 'Menyimpan…' : 'Ganti password'}</button></div>
        </form>
        <TelegramCard />
      </div>
    </>
  );
}
