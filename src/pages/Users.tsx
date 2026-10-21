import { useMemo, useState } from 'react';
import { Copy, KeyRound, Lock, Pencil, Plus, Search, Send, Trash2, Unlink, Unlock, Users as UsersIcon } from 'lucide-react';
import { call } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import type { Role, User } from '../lib/types';
import { useSession } from '../session';
import { Badge, Confirm, Empty, ErrorBox, Modal, SkeletonRows, Switch, copyText, useLoad, useToast } from '../components/ui';
import { DivisionSelect } from './Reminders';

export function UserStatus({ u }: { u: User }) {
  if (!u.isActive) return <Badge>Nonaktif</Badge>;
  if (u.locked) return <Badge tone="expired">Terkunci</Badge>;
  if (u.mustResetPassword) return <Badge tone="watch">Wajib ganti password</Badge>;
  return <Badge tone="fresh">Aktif</Badge>;
}

export function PasswordReveal({ username, password }: { username: string; password: string }) {
  const toast = useToast();
  return (
    <div className="pw-box">
      <KeyRound size={16} />
      <span className="grow">Password <b>{username}</b>: <code>{password}</code></span>
      <button className="btn btn-sm" onClick={async () => toast((await copyText(password)) ? 'Password disalin' : 'Gagal menyalin', false)}><Copy />Salin</button>
    </div>
  );
}

export function UsersPage() {
  const { user: me, divisions } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => call<{ users: User[] }>('users.list'), []);
  const [q, setQ] = useState('');
  const [div, setDiv] = useState('');
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [unlinkTg, setUnlinkTg] = useState<User | null>(null);
  const [revealed, setRevealed] = useState<{ username: string; password: string } | null>(null);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data?.users || [])
      .filter(u => !div || String(u.divisionId) === div)
      .filter(u => !n || [u.username, u.fullName, u.email, u.divisionName].join(' ').toLowerCase().includes(n));
  }, [data, q, div]);

  return (
    <>
      <div className="page-head">
        <div className="grow"><h1>Pengguna</h1><div className="sub">Kelola akun login per divisi. Kirim akses lewat menu Broadcast email.</div></div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus />Pengguna baru</button>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      {revealed && <div style={{ marginBottom: 16 }}><PasswordReveal {...revealed} /><div className="caption" style={{ marginTop: 6 }}>Password hanya ditampilkan sekali. Salin sekarang atau kirim lewat Broadcast email.</div></div>}
      <div className="panel">
        <div className="toolbar">
          <div className="search"><Search /><input className="input" placeholder="Cari username, nama, email…" value={q} onChange={e => setQ(e.target.value)} aria-label="Cari pengguna" /></div>
          <DivisionSelect value={div} onChange={setDiv} />
          <span className="spacer" /><span className="caption num">{rows.length} pengguna</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Username</th><th>Nama</th><th>Email</th><th>Peran</th><th>Divisi</th><th>Status</th><th>Telegram</th><th>Login terakhir</th><th aria-label="Aksi" /></tr></thead>
            {loading ? <SkeletonRows cols={9} /> : (
              <tbody>
                {rows.map(u => (
                  <tr key={u.id}>
                    <td className="num">{u.username}</td>
                    <td>{u.fullName || '—'}</td>
                    <td className="small">{u.email || <span className="faint">Belum diisi</span>}</td>
                    <td>{u.role === 'SUPERADMIN' ? <Badge tone="admin">Superadmin</Badge> : <Badge tone="brand" dot={false}>User</Badge>}</td>
                    <td>{u.divisionName || '—'}</td>
                    <td><UserStatus u={u} /></td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{u.telegram
                      ? <span className="row" title={`Terhubung ${fmtDateTime(u.telegram.linkedAt)}`}><Send size={14} />{u.telegram.username ? `@${u.telegram.username}` : u.telegram.name || 'Terhubung'}</span>
                      : <span className="faint">Belum</span>}</td>
                    <td className="small num" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(u.lastLoginAt)}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Ubah" aria-label={`Ubah ${u.username}`} onClick={() => setEditing(u)}><Pencil /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Buat password baru" aria-label={`Reset password ${u.username}`} onClick={() => setResetting(u)}><KeyRound /></button>
                      {u.locked && <button className="btn btn-ghost btn-icon btn-sm" title="Buka kunci" aria-label={`Buka kunci ${u.username}`} onClick={async () => { await call('users.unlock', { id: u.id }); toast('Kunci akun dibuka'); reload(); }}><Unlock /></button>}
                      {u.telegram && <button className="btn btn-ghost btn-icon btn-sm" title="Putuskan Telegram" aria-label={`Putuskan Telegram ${u.username}`} onClick={() => setUnlinkTg(u)}><Unlink /></button>}
                      {u.id !== me.id && <button className="btn btn-ghost btn-icon btn-sm" title="Hapus" aria-label={`Hapus ${u.username}`} onClick={() => setDeleting(u)}><Trash2 /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {!loading && !rows.length && <Empty icon={<UsersIcon />} title={divisions.length ? 'Belum ada pengguna yang cocok. Tambahkan pengguna untuk divisi ini.' : 'Buat divisi dulu sebelum menambah pengguna.'} />}
      </div>

      {editing && <UserForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)}
        onSaved={r => { setEditing(null); reload(); toast('Pengguna tersimpan'); if (r) setRevealed(r); }} />}
      {resetting && <ResetForm u={resetting} onClose={() => setResetting(null)} onDone={r => { setResetting(null); setRevealed(r); reload(); toast('Password baru dibuat'); }} />}
      {deleting && (
        <Confirm title="Hapus pengguna?" danger confirmLabel="Hapus pengguna"
          message={<>Akun <b>{deleting.username}</b> tidak bisa login lagi. Jejak aktivitasnya tetap tersimpan di log.</>}
          onConfirm={async () => { await call('users.delete', { id: deleting.id }); toast('Pengguna dihapus'); reload(); }}
          onClose={() => setDeleting(null)} />
      )}
      {unlinkTg && (
        <Confirm title="Putuskan Telegram?" danger confirmLabel="Putuskan"
          message={<>Telegram <b>{unlinkTg.telegram?.username ? `@${unlinkTg.telegram.username}` : unlinkTg.telegram?.name}</b> tidak lagi terhubung ke akun <b>{unlinkTg.username}</b>. Pengguna bisa menghubungkan ulang lewat /login di bot.</>}
          onConfirm={async () => { await call('telegram.unlink', { userId: unlinkTg.id }); toast('Telegram diputus'); reload(); }}
          onClose={() => setUnlinkTg(null)} />
      )}
    </>
  );
}

function UserForm({ initial, onClose, onSaved }: { initial?: User; onClose: () => void; onSaved: (r?: { username: string; password: string }) => void }) {
  const { divisions } = useSession();
  const [f, setF] = useState({
    username: initial?.username ?? '', fullName: initial?.fullName ?? '', email: initial?.email ?? '',
    role: (initial?.role ?? 'USER') as Role, divisionId: String(initial?.divisionId ?? ''), isActive: initial?.isActive ?? true,
    autoPassword: true, password: '', mustReset: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true); setErr('');
    const base = { username: f.username, fullName: f.fullName, email: f.email, role: f.role, divisionId: f.role === 'USER' ? Number(f.divisionId) || null : null, isActive: f.isActive };
    try {
      if (initial) { await call('users.update', { ...base, id: initial.id }); onSaved(); }
      else {
        const r = await call<{ username: string; password: string }>('users.create', { ...base, password: f.autoPassword ? undefined : f.password, mustReset: f.mustReset });
        onSaved(r);
      }
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Modal title={initial ? `Ubah ${initial.username}` : 'Pengguna baru'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn btn-primary" onClick={save} disabled={busy || !f.username}>{busy ? 'Menyimpan…' : 'Simpan pengguna'}</button>
    </>}>
      <div className="form-grid">
        <div className="field"><label className="req" htmlFor="uu">Username</label><input id="uu" className="input num" value={f.username} onChange={e => set('username', e.target.value.toLowerCase())} placeholder="nama.divisi" autoComplete="off" /></div>
        <div className="field"><label htmlFor="un">Nama lengkap</label><input id="un" className="input" value={f.fullName} onChange={e => set('fullName', e.target.value)} /></div>
        <div className="field full"><label htmlFor="ue">Email</label><input id="ue" type="email" className="input" value={f.email} onChange={e => set('email', e.target.value)} placeholder="nama@sig.id" />
          <div className="help">Dipakai untuk mengirim akses login lewat Broadcast email.</div></div>
        <div className="field"><label className="req" htmlFor="ur">Peran</label>
          <select id="ur" className="select" value={f.role} onChange={e => set('role', e.target.value as Role)}>
            <option value="USER">User (kelola divisinya sendiri)</option>
            <option value="SUPERADMIN">Superadmin (semua divisi)</option>
          </select></div>
        {f.role === 'USER' && (
          <div className="field"><label className="req" htmlFor="ud">Divisi</label>
            <select id="ud" className="select" value={f.divisionId} onChange={e => set('divisionId', e.target.value)}>
              <option value="">Pilih divisi…</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
        )}
        <div className="full row"><Switch checked={f.isActive} onChange={v => set('isActive', v)} label="Akun aktif" /><span>Akun aktif</span></div>
      </div>
      {!initial && (
        <div className="group">
          <h3>Password awal</h3>
          <div className="seg" role="group">
            <button type="button" aria-pressed={f.autoPassword} onClick={() => set('autoPassword', true)}>Buat otomatis</button>
            <button type="button" aria-pressed={!f.autoPassword} onClick={() => set('autoPassword', false)}>Tentukan sendiri</button>
          </div>
          {!f.autoPassword && <input className="input" value={f.password} onChange={e => set('password', e.target.value)} placeholder="Minimal 8 karakter, huruf dan angka" aria-label="Password awal" />}
          <label className="check"><input type="checkbox" checked={f.mustReset} onChange={e => set('mustReset', e.target.checked)} />Wajib ganti password saat login pertama</label>
        </div>
      )}
      {err && <ErrorBox>{err}</ErrorBox>}
    </Modal>
  );
}

function ResetForm({ u, onClose, onDone }: { u: User; onClose: () => void; onDone: (r: { username: string; password: string }) => void }) {
  const [auto, setAuto] = useState(true);
  const [pw, setPw] = useState('');
  const [mustReset, setMustReset] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { onDone(await call<{ username: string; password: string }>('users.resetPassword', { id: u.id, password: auto ? undefined : pw, mustReset })); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Modal title={`Password baru untuk ${u.username}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn btn-primary" onClick={save} disabled={busy || (!auto && !pw)}><Lock />{busy ? 'Memproses…' : 'Buat password'}</button>
    </>}>
      <p style={{ margin: 0 }}>Password lama langsung tidak berlaku. Untuk mengirimnya ke email pengguna, pakai menu Broadcast email.</p>
      <div className="seg" role="group">
        <button type="button" aria-pressed={auto} onClick={() => setAuto(true)}>Buat otomatis</button>
        <button type="button" aria-pressed={!auto} onClick={() => setAuto(false)}>Tentukan sendiri</button>
      </div>
      {!auto && <input className="input" value={pw} onChange={e => setPw(e.target.value)} placeholder="Minimal 8 karakter, huruf dan angka" aria-label="Password baru" />}
      <label className="check"><input type="checkbox" checked={mustReset} onChange={e => setMustReset(e.target.checked)} />Wajib ganti password saat login berikutnya</label>
      {err && <ErrorBox>{err}</ErrorBox>}
    </Modal>
  );
}
