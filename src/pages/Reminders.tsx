import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown, ArrowUp, Bell, CheckCircle2, History, Mail, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Search, Send, Trash2,
} from 'lucide-react';
import { call } from '../lib/api';
import { PRESETS, addDays, daysBetween, fmtDate, fmtDateTime, presetLabel, summarizeDays, todayJkt } from '../lib/format';
import type { Preset, Recurrence, Reminder } from '../lib/types';
import { useSession } from '../session';
import { Confirm, Drawer, Empty, ErrorBox, Modal, SkeletonRows, StatusBadge, useLoad, useToast } from '../components/ui';
import { MultiDatePicker } from '../components/MultiDatePicker';

export function DivisionSelect({ value, onChange, all = true }: { value: string; onChange: (v: string) => void; all?: boolean }) {
  const { divisions } = useSession();
  return (
    <select className="select" style={{ width: 'auto', height: 36 }} value={value} onChange={e => onChange(e.target.value)} aria-label="Divisi">
      {all && <option value="">Semua divisi</option>}
      {divisions.map(d => <option key={d.id} value={d.id}>{d.name}{d.isActive ? '' : ' (nonaktif)'}</option>)}
    </select>
  );
}

const FILTERS: { key: string; label: string; test: (r: Reminder) => boolean }[] = [
  { key: 'semua', label: 'Semua aktif', test: r => r.status !== 'COMPLETED' },
  { key: 'hari-ini', label: 'Hari ini', test: r => r.status === 'ACTIVE' && r.daysLeft === 0 },
  { key: '7', label: '≤ 7 hari', test: r => r.status === 'ACTIVE' && r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= 7 },
  { key: '30', label: '≤ 30 hari', test: r => r.status === 'ACTIVE' && r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= 30 },
  { key: 'lewat', label: 'Lewat', test: r => r.status === 'ACTIVE' && r.daysLeft != null && r.daysLeft < 0 },
  { key: 'jeda', label: 'Dijeda', test: r => r.status === 'PAUSED' },
  { key: 'selesai', label: 'Selesai', test: r => r.status === 'COMPLETED' },
];

type SortKey = 'dueDate' | 'name' | 'divisionName';

export function RemindersPage({ params }: { params: URLSearchParams }) {
  const { isSuper } = useSession();
  const toast = useToast();
  const [filter, setFilter] = useState(params.get('f') || 'semua');
  const [q, setQ] = useState(params.get('q') || '');
  const [cat, setCat] = useState('');
  const [div, setDiv] = useState(params.get('d') || '');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'dueDate', dir: 1 });
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);
  const [history, setHistory] = useState<Reminder | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'complete' | 'pause' | 'resume'; r: Reminder } | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => { setFilter(params.get('f') || 'semua'); setQ(params.get('q') || ''); if (params.get('d')) setDiv(params.get('d')!); }, [params]);

  const { data, error, loading, reload } = useLoad(() => call<{ today: string; reminders: Reminder[] }>('reminders.list', { divisionId: div || undefined }), [div]);
  const all = data?.reminders || [];
  const categories = useMemo(() => [...new Set(all.map(r => r.category).filter(Boolean))].sort(), [all]);

  const rows = useMemo(() => {
    const f = FILTERS.find(x => x.key === filter) || FILTERS[0];
    const needle = q.trim().toLowerCase();
    return all
      .filter(f.test)
      .filter(r => !cat || r.category === cat)
      .filter(r => !needle || [r.name, r.provider, r.category, r.uid, r.recipients, r.divisionName].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => {
        const k = sort.key;
        if (k === 'dueDate') return ((a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9)) * sort.dir;
        return String(a[k]).localeCompare(String(b[k])) * sort.dir;
      });
  }, [all, filter, q, cat, sort]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.key, all.filter(f.test).length])), [all]);

  const act = async (kind: 'delete' | 'complete' | 'pause' | 'resume', r: Reminder) => {
    if (kind === 'delete') await call('reminders.delete', { uid: r.uid, expectedVersion: r.version, reason });
    if (kind === 'complete') await call('reminders.complete', { uid: r.uid, expectedVersion: r.version });
    if (kind === 'pause') await call('reminders.setStatus', { uid: r.uid, expectedVersion: r.version, status: 'PAUSED' });
    if (kind === 'resume') await call('reminders.setStatus', { uid: r.uid, expectedVersion: r.version, status: 'ACTIVE' });
    toast({ delete: 'Reminder dihapus', complete: r.isRecurring ? 'Ditandai selesai, jatuh tempo berikutnya sudah dijadwalkan' : 'Ditandai selesai', pause: 'Reminder dijeda', resume: 'Reminder diaktifkan lagi' }[kind]);
    reload();
  };

  const SortTh = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="sortable" onClick={() => setSort(s => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <span className="row" style={{ gap: 4 }}>{children}{sort.key === k && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</span>
    </th>
  );

  return (
    <>
      <div className="page-head">
        <div className="grow"><h1>Reminder</h1><div className="sub">Daftar tugas yang harus diselesaikan sebelum jatuh tempo.</div></div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus />Reminder baru</button>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="panel">
        <div className="toolbar">
          <div className="chips" role="group" aria-label="Filter status">
            {FILTERS.map(f => (
              <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}<span className="cnt">{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar">
          <div className="search"><Search /><input className="input" placeholder="Cari nama, provider, penerima…" value={q} onChange={e => setQ(e.target.value)} aria-label="Cari reminder" /></div>
          <select className="select" value={cat} onChange={e => setCat(e.target.value)} aria-label="Kategori">
            <option value="">Semua kategori</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          {isSuper && <DivisionSelect value={div} onChange={setDiv} />}
          <span className="spacer" />
          <span className="caption num">{rows.length} baris</span>
        </div>

        <div className="table-wrap has-cards">
          <table className="data">
            <thead><tr>
              <SortTh k="name">Nama</SortTh>
              {isSuper && <SortTh k="divisionName">Divisi</SortTh>}
              <SortTh k="dueDate">Jatuh tempo</SortTh>
              <th>Status</th><th>Pengingat</th><th>Channel</th><th aria-label="Aksi" />
            </tr></thead>
            {loading ? <SkeletonRows cols={isSuper ? 7 : 6} /> : (
              <tbody>
                {rows.map(r => (
                  <tr key={r.uid} className={r.status === 'ACTIVE' && r.daysLeft != null && r.daysLeft <= 0 ? 'is-expired' : ''}>
                    <td style={{ minWidth: 240 }}>
                      <div className="cell-title">{r.name}{r.isRecurring && <Repeat size={12} style={{ marginLeft: 6, verticalAlign: -1 }} aria-label="Berulang" />}</div>
                      <div className="cell-sub">{[r.category, r.provider].filter(Boolean).join(' · ') || '—'}</div>
                    </td>
                    {isSuper && <td>{r.divisionName}</td>}
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.dueDate)}</td>
                    <td><StatusBadge r={r} /></td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{summarizeDays(r.reminderDays)}<div className="cell-sub">{presetLabel(r.preset)}</div></td>
                    <td><Channels r={r} /></td>
                    <td className="r"><RowMenu r={r} onEdit={() => setEditing(r)} onHistory={() => setHistory(r)} onAct={k => { setReason(''); setConfirm({ kind: k, r }); }} /></td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        <div className="cards">
          {rows.map(r => (
            <div key={r.uid} className={`rcard ${r.status === 'ACTIVE' && r.daysLeft != null && r.daysLeft <= 0 ? 'is-expired' : ''}`}>
              <div className="row"><div className="cell-title grow">{r.name}</div><StatusBadge r={r} /></div>
              <div className="cell-sub">{[isSuper && r.divisionName, r.category, r.provider].filter(Boolean).join(' · ')}</div>
              <div className="row small"><span className="num">Jatuh tempo {fmtDate(r.dueDate)}</span><span className="spacer" /><Channels r={r} />
                <RowMenu r={r} onEdit={() => setEditing(r)} onHistory={() => setHistory(r)} onAct={k => { setReason(''); setConfirm({ kind: k, r }); }} /></div>
            </div>
          ))}
        </div>
        {!loading && !rows.length && (
          <Empty icon={<Bell />} title={all.length ? 'Tidak ada reminder yang cocok dengan filter ini.' : 'Belum ada reminder. Tambahkan tugas pertama yang perlu diingatkan.'}
            action={!all.length && <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus />Reminder baru</button>} />
        )}
      </div>

      {editing && <ReminderForm initial={editing === 'new' ? undefined : editing} defaultDivision={div} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {history && <HistoryDrawer r={history} onClose={() => setHistory(null)} />}
      {confirm && (
        <Confirm
          title={{ delete: 'Hapus reminder?', complete: 'Tandai selesai?', pause: 'Jeda reminder?', resume: 'Aktifkan lagi?' }[confirm.kind]}
          message={{
            delete: <>Reminder <b>{confirm.r.name}</b> tidak akan dikirim lagi. Datanya tetap tersimpan untuk audit dan bisa dilihat superadmin.</>,
            complete: confirm.r.isRecurring
              ? <>Tugas <b>{confirm.r.name}</b> ditandai selesai. Karena berulang ({confirm.r.recurrenceType === 'MONTHLY' ? 'bulanan' : 'tahunan'}), jatuh tempo digeser ke periode berikutnya.</>
              : <>Tugas <b>{confirm.r.name}</b> ditandai selesai dan pengingat berhenti dikirim.</>,
            pause: <>Pengingat untuk <b>{confirm.r.name}</b> berhenti dikirim sampai diaktifkan lagi.</>,
            resume: <>Pengingat untuk <b>{confirm.r.name}</b> akan dikirim lagi sesuai jadwal.</>,
          }[confirm.kind]}
          confirmLabel={{ delete: 'Hapus reminder', complete: 'Tandai selesai', pause: 'Jeda', resume: 'Aktifkan' }[confirm.kind]}
          danger={confirm.kind === 'delete'}
          onConfirm={() => act(confirm.kind, confirm.r)}
          onClose={() => setConfirm(null)}>
          {confirm.kind === 'delete' && (
            <div className="field"><label htmlFor="reason">Alasan (untuk audit)</label><input id="reason" className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Misal: kontrak tidak diperpanjang" /></div>
          )}
        </Confirm>
      )}
    </>
  );
}

function Channels({ r }: { r: Reminder }) {
  return (
    <span className="row" style={{ gap: 6, color: 'var(--ink-muted)' }}>
      {r.channelEmail && <span title={`Email: ${r.recipients}`} aria-label="Email"><Mail size={16} /></span>}
      {r.channelTelegram && <span title={r.divisionHasTelegram ? 'Telegram grup divisi' : 'Telegram — divisi belum punya Chat ID'} aria-label="Telegram" style={{ color: r.divisionHasTelegram ? undefined : 'var(--critical)' }}><Send size={16} /></span>}
    </span>
  );
}

function RowMenu({ r, onEdit, onHistory, onAct }: { r: Reminder; onEdit: () => void; onHistory: () => void; onAct: (k: 'delete' | 'complete' | 'pause' | 'resume') => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Menu dirender di body (portal) supaya tidak terpotong overflow tabel; posisinya mengikuti tombol
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      const m = menuRef.current;
      if (!b || !m) return;
      const gap = 6;
      const h = m.offsetHeight;
      const w = m.offsetWidth;
      const below = window.innerHeight - b.bottom - gap;
      const top = below >= h || b.top < h + gap ? Math.min(b.bottom + gap, window.innerHeight - h - 8) : b.top - h - gap;
      const left = Math.min(Math.max(8, b.right - w), window.innerWidth - w - 8);
      setPos({ top: Math.max(8, top), left });
    };
    place();
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);

  const item = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <>
      <button ref={btnRef} className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(o => !o)} aria-label={`Aksi untuk ${r.name}`} aria-haspopup="menu" aria-expanded={open}><MoreHorizontal /></button>
      {open && createPortal(
        <div ref={menuRef} className="menu menu-floating" role="menu"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
          <button role="menuitem" onClick={item(onEdit)}><Pencil />Ubah</button>
          <button role="menuitem" onClick={item(onHistory)}><History />Riwayat perubahan</button>
          {r.status !== 'COMPLETED' && <button role="menuitem" onClick={item(() => onAct('complete'))}><CheckCircle2 />Tandai selesai</button>}
          {r.status === 'ACTIVE' && <button role="menuitem" onClick={item(() => onAct('pause'))}><Pause />Jeda pengingat</button>}
          {r.status !== 'ACTIVE' && <button role="menuitem" onClick={item(() => onAct('resume'))}><Play />Aktifkan lagi</button>}
          <button role="menuitem" className="danger" onClick={item(() => onAct('delete'))}><Trash2 />Hapus</button>
        </div>,
        document.body,
      )}
    </>
  );
}

// ===== Form tambah / ubah reminder =====
export function ReminderForm({ initial, defaultDivision, onClose, onSaved }: { initial?: Reminder; defaultDivision?: string; onClose: () => void; onSaved: () => void }) {
  const { isSuper, divisions, user } = useSession();
  const toast = useToast();
  const [f, setF] = useState(() => ({
    divisionId: String(initial?.divisionId ?? (defaultDivision || (isSuper ? '' : user.divisionId ?? ''))),
    name: initial?.name ?? '', category: initial?.category ?? '', provider: initial?.provider ?? '', description: initial?.description ?? '',
    dueDate: initial?.dueDate ?? addDays(todayJkt(), 30),
    preset: (initial?.preset ?? 'STANDAR') as Preset, reminderDays: initial?.reminderDays ?? PRESETS.STANDAR.days,
    channelEmail: initial?.channelEmail ?? true, channelTelegram: initial?.channelTelegram ?? false, recipients: initial?.recipients ?? '',
    isRecurring: initial?.isRecurring ?? false, recurrenceType: (initial?.recurrenceType && initial.recurrenceType !== 'NONE' ? initial.recurrenceType : 'YEARLY') as Recurrence,
    note: '',
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));
  const div = divisions.find(d => String(d.id) === f.divisionId);
  const daysToDue = f.dueDate ? daysBetween(todayJkt(), f.dueDate) : 0;
  const pastDays = f.reminderDays.filter(d => d > daysToDue).length;

  const pickPreset = (p: Preset) => {
    if (p === 'CUSTOM') { set('preset', 'CUSTOM'); return; }
    setF(x => ({ ...x, preset: p, reminderDays: PRESETS[p].days }));
  };

  const save = async () => {
    setErr('');
    if (!f.name.trim()) return setErr('Nama reminder wajib diisi.');
    if (!f.dueDate) return setErr('Tanggal jatuh tempo wajib diisi.');
    if (!f.reminderDays.length) return setErr('Pilih minimal satu hari pengingat.');
    if (!f.channelEmail && !f.channelTelegram) return setErr('Pilih minimal satu channel: Email atau Telegram.');
    if (isSuper && !f.divisionId) return setErr('Pilih divisi pemilik reminder.');
    setBusy(true);
    const payload = {
      name: f.name, category: f.category, provider: f.provider, description: f.description, dueDate: f.dueDate,
      preset: f.preset, reminderDays: f.reminderDays, channelEmail: f.channelEmail, channelTelegram: f.channelTelegram,
      recipients: f.recipients, isRecurring: f.isRecurring, recurrenceType: f.isRecurring ? f.recurrenceType : 'NONE',
      ...(isSuper ? { divisionId: Number(f.divisionId) } : {}),
    };
    try {
      if (initial) await call('reminders.update', { ...payload, uid: initial.uid, expectedVersion: initial.version, note: f.note || undefined });
      else await call('reminders.create', payload);
      toast(initial ? 'Perubahan tersimpan sebagai versi baru' : 'Reminder dibuat');
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Modal size="lg" title={initial ? 'Ubah reminder' : 'Reminder baru'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : initial ? 'Simpan perubahan' : 'Buat reminder'}</button>
    </>}>
      <div className="form-grid">
        <div className="field full"><label className="req" htmlFor="rn">Nama tugas</label><input id="rn" className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Misal: Perpanjangan lisensi Fortinet" maxLength={200} /></div>
        {isSuper && (
          <div className="field"><label className="req" htmlFor="rd">Divisi</label>
            <select id="rd" className="select" value={f.divisionId} onChange={e => set('divisionId', e.target.value)}>
              <option value="">Pilih divisi…</option>
              {divisions.filter(d => d.isActive).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <div className="field"><label htmlFor="rc">Kategori</label><input id="rc" className="input" value={f.category} onChange={e => set('category', e.target.value)} placeholder="Software / License" /></div>
        <div className="field"><label htmlFor="rp">Vendor / provider</label><input id="rp" className="input" value={f.provider} onChange={e => set('provider', e.target.value)} placeholder="PT …" /></div>
        <div className="field"><label className="req" htmlFor="rdue">Tanggal jatuh tempo</label><input id="rdue" type="date" className="input num" value={f.dueDate} onChange={e => set('dueDate', e.target.value)} /></div>
        <div className="field full"><label htmlFor="rdesc">Keterangan</label><textarea id="rdesc" className="textarea" value={f.description} onChange={e => set('description', e.target.value)} placeholder="Catatan tambahan yang ikut dikirim di email" /></div>
      </div>

      <div className="group">
        <div className="row wrap"><h3 className="grow">Kapan diingatkan</h3><span className="caption">{f.reminderDays.length} hari terpilih</span></div>
        <div className="seg" role="group" aria-label="Pilihan default">
          {(['STANDAR', 'KETAT', 'PANJANG', 'CUSTOM'] as Preset[]).map(p => (
            <button key={p} type="button" aria-pressed={f.preset === p} onClick={() => pickPreset(p)}>{presetLabel(p)}</button>
          ))}
        </div>
        <div className="help">{f.preset === 'CUSTOM' ? 'Pilih sendiri tanggal-tanggalnya di kalender.' : PRESETS[f.preset].hint + '. Klik tanggal di kalender untuk menyesuaikan.'}</div>
        {f.dueDate && <MultiDatePicker dueDate={f.dueDate} days={f.reminderDays} onChange={d => setF(x => ({ ...x, reminderDays: d, preset: 'CUSTOM' }))} />}
        {pastDays > 0 && !f.isRecurring && <div className="alert alert-warn">{pastDays} tanggal pengingat sudah lewat dan tidak akan terkirim. Reminder yang sudah lewat jatuh tempo tetap dikirim setiap hari sampai ditandai selesai.</div>}
      </div>

      <div className="group">
        <h3>Dikirim lewat</h3>
        <label className="check"><input type="checkbox" checked={f.channelEmail} onChange={e => set('channelEmail', e.target.checked)} />Email</label>
        {f.channelEmail && (
          <div className="field"><label className="req" htmlFor="rr">Penerima email</label>
            <textarea id="rr" className="textarea" style={{ minHeight: 56 }} value={f.recipients} onChange={e => set('recipients', e.target.value)} placeholder="nama@sig.id, nama2@sig.id" />
            <div className="help">Pisahkan beberapa alamat dengan koma.</div>
          </div>
        )}
        <label className="check"><input type="checkbox" checked={f.channelTelegram} onChange={e => set('channelTelegram', e.target.checked)} />Telegram grup divisi</label>
        {f.channelTelegram && div && !div.hasTelegram && <div className="alert alert-warn">Divisi {div.name} belum punya Telegram Chat ID, jadi pesan Telegram belum bisa dikirim. Minta superadmin mengisinya di menu Divisi.</div>}
      </div>

      <div className="group">
        <label className="check"><input type="checkbox" checked={f.isRecurring} onChange={e => set('isRecurring', e.target.checked)} />Berulang setelah ditandai selesai</label>
        {f.isRecurring && (
          <div className="seg" role="group" aria-label="Periode">
            <button type="button" aria-pressed={f.recurrenceType === 'MONTHLY'} onClick={() => set('recurrenceType', 'MONTHLY')}>Bulanan</button>
            <button type="button" aria-pressed={f.recurrenceType === 'YEARLY'} onClick={() => set('recurrenceType', 'YEARLY')}>Tahunan</button>
          </div>
        )}
      </div>

      {initial && (
        <div className="field"><label htmlFor="rnote">Catatan perubahan</label><input id="rnote" className="input" value={f.note} onChange={e => set('note', e.target.value)} placeholder="Misal: tanggal kontrak baru dari vendor" />
          <div className="help">Perubahan disimpan sebagai versi {initial.version + 1}. Versi lama tetap tersimpan untuk audit.</div></div>
      )}
      {err && <ErrorBox>{err}</ErrorBox>}
    </Modal>
  );
}

// ===== Riwayat versi (soft update) =====
const FIELDS: [keyof Reminder, string, (v: unknown) => string][] = [
  ['name', 'Nama', v => String(v || '—')], ['divisionName', 'Divisi', v => String(v || '—')], ['category', 'Kategori', v => String(v || '—')],
  ['provider', 'Provider', v => String(v || '—')], ['dueDate', 'Jatuh tempo', v => fmtDate(v as string)],
  ['reminderDays', 'Hari pengingat', v => (v as number[]).map(d => (d === 0 ? 'H' : `H-${d}`)).join(', ')],
  ['status', 'Status', v => ({ ACTIVE: 'Aktif', PAUSED: 'Dijeda', COMPLETED: 'Selesai' }[v as string] || String(v))],
  ['recipients', 'Penerima', v => String(v || '—')], ['channelEmail', 'Email', v => (v ? 'Ya' : 'Tidak')], ['channelTelegram', 'Telegram', v => (v ? 'Ya' : 'Tidak')],
  ['description', 'Keterangan', v => String(v || '—')], ['recurrenceType', 'Berulang', v => ({ NONE: 'Tidak', MONTHLY: 'Bulanan', YEARLY: 'Tahunan' }[v as string] || String(v))],
];

function HistoryDrawer({ r, onClose }: { r: Reminder; onClose: () => void }) {
  const { data, error, loading } = useLoad(() => call<{ versions: Reminder[] }>('reminders.history', { uid: r.uid }), [r.uid]);
  const vs = data?.versions || [];
  return (
    <Drawer title="Riwayat perubahan" onClose={onClose}>
      <div><div className="cell-title">{r.name}</div><div className="caption num">{r.uid}</div></div>
      {error && <ErrorBox>{error}</ErrorBox>}
      {loading ? <div className="skel" style={{ height: 120 }} /> : (
        <div className="timeline">
          {vs.map((v, i) => {
            const prev = vs[i + 1];
            const changes = prev ? FIELDS.filter(([k]) => JSON.stringify(v[k]) !== JSON.stringify(prev[k])) : [];
            const when = v.version === 1 ? v.createdAt : v.updatedAt || v.createdAt;
            return (
              <div key={v.version} className="tl-item">
                <span className="tl-dot" style={v.isDeleted ? { background: 'var(--expired)' } : undefined} />
                <div className="stack" style={{ gap: 6 }}>
                  <div className="row wrap">
                    <strong>Versi {v.version}</strong>
                    {!v.isUpdated && !v.isDeleted && <span className="badge b-brand">Berlaku</span>}
                    {v.isDeleted && <span className="badge b-expired">Dihapus</span>}
                  </div>
                  <div className="caption">{v.changeNote || (v.version === 1 ? 'Dibuat' : 'Diperbarui')} · {v.version === 1 ? v.createdBy : v.updatedBy || v.createdBy} · {fmtDateTime(when)}</div>
                  {v.isDeleted && <div className="caption">Dihapus oleh {v.deletedBy} · {fmtDateTime(v.deletedAt)}</div>}
                  {changes.length > 0 && (
                    <dl className="kv" style={{ marginTop: 4 }}>
                      {changes.map(([k, label, fmt]) => (
                        <div key={k} style={{ display: 'contents' }}>
                          <dt>{label}</dt>
                          <dd><span className="diff-old">{fmt(prev![k])}</span> → <span className="diff-new">{fmt(v[k])}</span></dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
