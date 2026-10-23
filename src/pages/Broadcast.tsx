import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Mail, RotateCcw, Save, Send, XCircle } from 'lucide-react';
import { call } from '../lib/api';
import type { Setting, User } from '../lib/types';
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
  const tpl = useTemplate();

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
      template: { subject: tpl.subject, body: tpl.body },
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
              <thead><tr><th style={{ width: 36 }} aria-label="Pilih" /><th>Username</th><th>Nama</th><th>Email</th><th>Unit kerja</th><th>Status</th><th>Password</th></tr></thead>
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
          {!loading && !users.length && <Empty icon={<Mail />} title="Belum ada pengguna di unit kerja ini. Tambahkan dulu di menu Pengguna." />}
        </div>

        <div className="panel panel-pad stack">
          <h2>Pengaturan kiriman</h2>
          <div className="row"><Switch checked={mustReset} onChange={setMustReset} label="Wajib ganti password" /><span className="grow">Wajib ganti password saat login pertama</span></div>
          <div className="help">Kolom password yang dikosongkan akan dibuat otomatis (10 karakter acak). Isi kolom itu kalau ingin menentukan password sendiri.</div>
          <EmailEditor tpl={tpl} mustReset={mustReset} sample={chosen[0] || null} />
          <div><button className="btn btn-primary" disabled={!sel.size || !!tpl.problem} onClick={() => setConfirm(true)}><Send />Kirim ke {sel.size} pengguna</button></div>
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

// ===== Template email broadcast =====
const DEFAULT_SUBJECT = 'Akses Dashboard Reminder UTSG';
const DEFAULT_BODY = 'Halo {nama},\n\nberikut akses login Dashboard Reminder UTSG untuk unit kerja {unit_kerja}.\n\nAlamat: {link}\nUsername: {username}\nPassword: {password}\n\nJangan bagikan password ini kepada siapa pun.';
const TOKENS: [string, string][] = [['{nama}', 'Nama'], ['{username}', 'Username'], ['{password}', 'Password'], ['{unit_kerja}', 'Unit kerja'], ['{link}', 'Alamat dashboard']];

type Template = ReturnType<typeof useTemplate>;

function useTemplate() {
  const toast = useToast();
  const [saved, setSaved] = useState({ subject: DEFAULT_SUBJECT, body: DEFAULT_BODY });
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    call<{ settings: Setting[] }>('settings.get').then(r => {
      const get = (k: string) => r.settings.find(x => x.key === k)?.value || '';
      const t = { subject: get('BROADCAST_SUBJECT') || DEFAULT_SUBJECT, body: get('BROADCAST_BODY') || DEFAULT_BODY };
      setSaved(t); setSubject(t.subject); setBody(t.body);
    }).catch(() => { /* pakai template bawaan */ });
  }, []);
  const missing = ['{username}', '{password}'].filter(k => !body.includes(k));
  const problem = !subject.trim() ? 'Subjek email wajib diisi.'
    : missing.length ? `Isi email wajib memuat ${missing.join(' dan ')} supaya penerima tahu akses loginnya.` : '';
  const save = async () => {
    setSaving(true);
    try {
      if (subject !== saved.subject) await call('settings.update', { key: 'BROADCAST_SUBJECT', value: subject });
      if (body !== saved.body) await call('settings.update', { key: 'BROADCAST_BODY', value: body });
      setSaved({ subject, body }); toast('Template email disimpan');
    } catch (e) { toast((e as Error).message, true); }
    setSaving(false);
  };
  const reset = () => { setSubject(DEFAULT_SUBJECT); setBody(DEFAULT_BODY); };
  return { subject, setSubject, body, setBody, problem, save, saving, reset, dirty: subject !== saved.subject || body !== saved.body };
}

/** Ganti placeholder dengan nilai contoh untuk pratinjau */
function renderTokens(text: string, vals: Record<string, string>, strong: boolean): ReactNode[] {
  return text.split(/(\{(?:nama|username|password|unit_kerja|divisi|link)\})/g).map((part, i) => {
    const key = part.slice(1, -1);
    if (!(part.startsWith('{') && key in vals)) return part;
    if (!strong) return vals[key];
    if (key === 'link') return <a key={i} href={vals.link} target="_blank" rel="noreferrer">{vals.link}</a>;
    if (key === 'username' || key === 'password') return <code key={i} className="tok-val">{vals[key]}</code>;
    return <b key={i}>{vals[key]}</b>;
  });
}

function EmailEditor({ tpl, mustReset, sample }: { tpl: Template; mustReset: boolean; sample: User | null }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const vals = {
    nama: sample?.fullName || sample?.username || 'Budi Santoso', username: sample?.username || 'budi.ict',
    password: 'Xy7#kP2mQa', unit_kerja: sample?.divisionName || 'ICT', divisi: sample?.divisionName || 'ICT', link: window.location.origin,
  };
  const insert = (tok: string) => {
    const el = ref.current;
    if (!el) return tpl.setBody(tpl.body + tok);
    const { selectionStart: a, selectionEnd: b } = el;
    tpl.setBody(tpl.body.slice(0, a) + tok + tpl.body.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tok.length, a + tok.length); });
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row wrap"><div className="label grow">Pratinjau email</div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={tpl.reset}><RotateCcw />Kembalikan bawaan</button>
        <button type="button" className="btn btn-sm" onClick={tpl.save} disabled={!tpl.dirty || !!tpl.problem || tpl.saving}><Save />{tpl.saving ? 'Menyimpan…' : 'Simpan template'}</button>
      </div>
      <div className="mail-edit">
        <div className="field"><label htmlFor="bs">Subjek</label><input id="bs" className="input" value={tpl.subject} onChange={e => tpl.setSubject(e.target.value)} maxLength={200} /></div>
        <div className="field"><label htmlFor="bb">Isi email</label>
          <textarea id="bb" ref={ref} className="textarea" style={{ minHeight: 200, fontFamily: 'var(--font-ui)' }} value={tpl.body} onChange={e => tpl.setBody(e.target.value)} maxLength={5000} />
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="caption">Sisipkan:</span>
            {TOKENS.map(([t, label]) => <button key={t} type="button" className="chip" style={{ height: 26 }} onClick={() => insert(t)} title={`Sisipkan ${t}`}>{label}</button>)}
          </div>
        </div>
        {tpl.problem && <ErrorBox>{tpl.problem}</ErrorBox>}
      </div>
      <div className="mail-preview" aria-label="Tampilan email yang diterima">
        <div className="caption" style={{ marginBottom: 8 }}>Tampilan untuk {sample ? <b>{sample.username}</b> : 'contoh penerima'} · password di bawah hanya contoh</div>
        <div className="mail-card">
          <h3>{renderTokens(tpl.subject, { ...vals, password: '***' }, false)}</h3>
          <div style={{ whiteSpace: 'pre-wrap' }}>{renderTokens(tpl.body, vals, true)}</div>
          {mustReset && <div className="mail-note">Anda akan diminta mengganti password saat login pertama.</div>}
          <div className="caption">Email dikirim otomatis oleh sistem Reminder UTSG.</div>
        </div>
      </div>
    </div>
  );
}
