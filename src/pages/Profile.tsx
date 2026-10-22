import { useState, type FormEvent } from 'react';
import { Mail, Moon, Plus, Sun, X } from 'lucide-react';
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
            <dt>Username</dt><dd className="num">{user.username}</dd>
            <dt>Peran</dt><dd>{isSuper ? <Badge tone="admin">Superadmin</Badge> : <Badge tone="brand">User</Badge>}</dd>
            {!isSuper && <><dt>Divisi</dt><dd>{user.divisionName}</dd></>}
            <dt>Login terakhir</dt><dd>{fmtDateTime(user.lastLoginAt)}</dd>
            <dt>Ganti password</dt><dd>{fmtDateTime(user.passwordChangedAt)}</dd>
          </dl>
          <div className="group">
            <div className="row">{dark ? <Moon size={16} /> : <Sun size={16} />}<span className="grow">Mode gelap</span><Switch checked={dark} onChange={toggleTheme} label="Mode gelap" /></div>
          </div>
        </div>
        <AccountForm />
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

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Ubah nama, email akun, dan daftar email yang menerima reminder */
function AccountForm() {
  const { user, setUser, isSuper } = useSession();
  const toast = useToast();
  const [name, setName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [list, setList] = useState<string[]>(user.reminderEmails || []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const dirty = name !== user.fullName || email !== user.email || list.join(',') !== (user.reminderEmails || []).join(',') || !!draft.trim();

  const addDraft = (cur = list) => {
    const items = draft.split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!items.length) return cur;
    const bad = items.filter(x => !EMAIL_RE.test(x));
    if (bad.length) { setErr(`Email tidak valid: ${bad.join(', ')}`); return null; }
    const next = [...new Set([...cur, ...items])];
    if (next.length > 10) { setErr('Maksimal 10 email pengingat.'); return null; }
    setErr(''); setDraft(''); setList(next);
    return next;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const reminderEmails = addDraft();
    if (!reminderEmails) return;
    if (!name.trim()) return setErr('Nama lengkap wajib diisi.');
    if (email && !EMAIL_RE.test(email.trim())) return setErr('Format email akun tidak valid.');
    setBusy(true); setErr('');
    try {
      const r = await call<{ user: User }>('auth.updateProfile', { fullName: name, email: email.trim(), reminderEmails });
      setUser(r.user); setList(r.user.reminderEmails || []);
      toast('Informasi akun tersimpan');
    } catch (ex) { setErr((ex as Error).message); }
    setBusy(false);
  };

  return (
    <form className="panel panel-pad stack" onSubmit={submit}>
      <h2>Informasi akun</h2>
      <div className="field"><label className="req" htmlFor="af">Nama lengkap</label><input id="af" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={120} autoComplete="name" /></div>
      <div className="field"><label htmlFor="ae">Email akun</label><input id="ae" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@sig.id" autoComplete="email" />
        <div className="help">Dipakai superadmin untuk mengirim akses login.</div></div>
      <div className="field">
        <label htmlFor="arm">Email penerima reminder</label>
        <div className="row">
          <input id="arm" className="input grow" value={draft} onChange={e => setDraft(e.target.value)} placeholder="nama@sig.id"
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addDraft(); } }} />
          <button type="button" className="btn" onClick={() => addDraft()} disabled={!draft.trim()}><Plus />Tambah</button>
        </div>
        {list.length > 0 ? (
          <div className="daychips" aria-label="Email penerima reminder" style={{ marginTop: 8 }}>
            {list.map(m => (
              <span key={m} className="daychip"><Mail size={12} />{m}
                <button type="button" onClick={() => setList(l => l.filter(x => x !== m))} aria-label={`Hapus ${m}`}><X /></button>
              </span>
            ))}
          </div>
        ) : <div className="help">Belum ada. Email yang ditambahkan di sini ikut menerima reminder.</div>}
        <div className="help">{isSuper ? 'Sebagai superadmin, email ini menerima reminder dari semua divisi.' : `Email ini menerima semua reminder email divisi ${user.divisionName}, selain penerima yang diatur di tiap reminder.`} Maksimal 10 email.</div>
        {list.length === 0 && user.email && <div><button type="button" className="btn btn-sm btn-ghost" onClick={() => setList([user.email.toLowerCase()])}><Plus />Pakai email akun ({user.email})</button></div>}
      </div>
      {err && <ErrorBox>{err}</ErrorBox>}
      <div><button className="btn btn-primary" disabled={busy || !dirty}>{busy ? 'Menyimpan…' : 'Simpan informasi akun'}</button></div>
    </form>
  );
}
