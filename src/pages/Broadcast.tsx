import { useMemo, useState } from 'react';
import { CheckCircle2, Mail, Send, XCircle } from 'lucide-react';
import { call } from '../lib/api';
import type { User } from '../lib/types';
import { Badge, Confirm, Empty, ErrorBox, SkeletonRows, Switch, useLoad, useToast } from '../components/ui';
import { DivisionSelect } from './Reminders';
import { UserStatus } from './Users';

type Result = { userId: number; username: string; email: string; sent: boolean; error: string | null };
type Skipped = { userId: number; username: string; reason: string };

export function BroadcastPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => call<{ users: User[] }>('users.list'), []);
  const [div, setDiv] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [manual, setManual] = useState<Record<number, string>>({});
  const [mustReset, setMustReset] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ results: Result[]; skipped: Skipped[] } | null>(null);

  const users = useMemo(() => (data?.users || []).filter(u => !div || String(u.divisionId) === div), [data, div]);
  const eligible = users.filter(u => u.email && u.isActive);
  const allChecked = eligible.length > 0 && eligible.every(u => sel.has(u.id));
  const toggle = (id: number) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const chosen = (data?.users || []).filter(u => sel.has(u.id));

  const send = async () => {
    const passwords: Record<number, string> = {};
    for (const u of chosen) if (manual[u.id]) passwords[u.id] = manual[u.id];
    const r = await call<{ results: Result[]; skipped: Skipped[] }>('broadcast.send', {
      userIds: chosen.map(u => u.id), mustReset, passwords, dashboardUrl: window.location.origin,
    });
    setResult(r);
    const ok = r.results.filter(x => x.sent).length;
    toast(`${ok} dari ${r.results.length} email terkirim`, ok < r.results.length);
    setSel(new Set()); setManual({});
    reload();
  };

  return (
    <>
      <div className="page-head">
        <div className="grow"><h1>Broadcast email</h1><div className="sub">Kirim username dan password ke email pengguna. Setiap penerima mendapat password baru.</div></div>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}

      {result && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><h3 className="grow">Hasil pengiriman</h3><button className="btn btn-sm btn-ghost" onClick={() => setResult(null)}>Tutup</button></div>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Username</th><th>Email</th><th>Hasil</th></tr></thead>
            <tbody>
              {result.results.map(r => (
                <tr key={r.userId}><td className="num">{r.username}</td><td>{r.email}</td>
                  <td>{r.sent ? <span className="row" style={{ color: 'var(--fresh-ink)' }}><CheckCircle2 size={16} />Terkirim</span> : <span className="row" style={{ color: 'var(--expired)' }}><XCircle size={16} />{r.error}</span>}</td></tr>
              ))}
              {result.skipped.map(s => <tr key={'s' + s.userId}><td className="num">{s.username}</td><td className="faint">—</td><td className="muted">Dilewati: {s.reason}</td></tr>)}
            </tbody>
          </table></div>
          {result.results.some(r => !r.sent) && <div style={{ padding: 16 }}><div className="alert alert-warn">Password pengguna yang gagal dikirim sudah terlanjur diganti. Kirim ulang ke pengguna tersebut.</div></div>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
        <div className="panel">
          <div className="toolbar">
            <DivisionSelect value={div} onChange={setDiv} />
            <label className="check"><input type="checkbox" checked={allChecked} onChange={e => setSel(s => { const n = new Set(s); eligible.forEach(u => e.target.checked ? n.add(u.id) : n.delete(u.id)); return n; })} />Pilih semua yang punya email</label>
            <span className="spacer" />
            <span className="caption num">{sel.size} dipilih</span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th style={{ width: 36 }} aria-label="Pilih" /><th>Username</th><th>Nama</th><th>Email</th><th>Divisi</th><th>Status</th><th>Password</th></tr></thead>
              {loading ? <SkeletonRows cols={7} /> : (
                <tbody>
                  {users.map(u => {
                    const can = !!u.email && u.isActive;
                    return (
                      <tr key={u.id} style={can ? undefined : { opacity: .55 }}>
                        <td><input type="checkbox" disabled={!can} checked={sel.has(u.id)} onChange={() => toggle(u.id)} aria-label={`Pilih ${u.username}`} style={{ accentColor: 'var(--brand)', width: 16, height: 16 }} /></td>
                        <td className="num">{u.username}</td>
                        <td>{u.fullName || '—'}</td>
                        <td className="small">{u.email || <span className="faint">Isi email dulu di menu Pengguna</span>}</td>
                        <td>{u.divisionName || (u.role === 'SUPERADMIN' ? <Badge tone="admin">Superadmin</Badge> : '—')}</td>
                        <td><UserStatus u={u} /></td>
                        <td style={{ minWidth: 180 }}>
                          {sel.has(u.id) ? <input className="input" style={{ height: 32 }} value={manual[u.id] || ''} onChange={e => setManual(m => ({ ...m, [u.id]: e.target.value }))} placeholder="Otomatis" aria-label={`Password manual ${u.username}`} /> : <span className="faint small">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
          {!loading && !users.length && <Empty icon={<Mail />} title="Belum ada pengguna di divisi ini. Tambahkan dulu di menu Pengguna." />}
        </div>

        <div className="panel panel-pad stack">
          <h2>Pengaturan kiriman</h2>
          <div className="row"><Switch checked={mustReset} onChange={setMustReset} label="Wajib ganti password" /><span className="grow">Wajib ganti password saat login pertama</span></div>
          <div className="help">Kolom password yang dikosongkan akan dibuat otomatis (10 karakter acak). Isi kolom itu kalau ingin menentukan password sendiri.</div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Pratinjau email</div>
            <div className="code" style={{ fontFamily: 'var(--font-ui)', fontSize: 13 }}>
              <b>Akses Dashboard Reminder UTSG</b>{'\n'}Halo [nama], berikut akses login Anda untuk divisi [divisi].{'\n'}Alamat: {window.location.origin}{'\n'}Username: [username]{'\n'}Password: [password baru]{'\n'}{mustReset ? 'Anda akan diminta mengganti password saat login pertama.' : ''}
            </div>
          </div>
          <div><button className="btn btn-primary" disabled={!sel.size} onClick={() => setConfirm(true)}><Send />Kirim ke {sel.size} pengguna</button></div>
        </div>
      </div>

      {confirm && (
        <Confirm title={`Kirim akses ke ${chosen.length} pengguna?`} confirmLabel={`Kirim ${chosen.length} email`}
          message={<>Password <b>{chosen.map(u => u.username).join(', ')}</b> akan diganti dan password lama langsung tidak berlaku.</>}
          onConfirm={send} onClose={() => setConfirm(false)} />
      )}
    </>
  );
}
