import { useMemo, useState } from 'react';
import { FileClock, Mail, RefreshCw, Search } from 'lucide-react';
import { call } from '../lib/api';
import { addDays, fmtDateTime, todayJkt } from '../lib/format';
import type { ActivityLog, NotificationLog } from '../lib/types';
import { Badge, Drawer, Empty, ErrorBox, SkeletonRows, useLoad } from '../components/ui';
import { DivisionSelect } from './Reminders';

const ACTIONS: Record<string, { label: string; tone: 'fresh' | 'watch' | 'critical' | 'expired' | 'neutral' | 'brand' | 'admin' }> = {
  LOGIN: { label: 'Login', tone: 'fresh' }, LOGIN_FAILED: { label: 'Login gagal', tone: 'expired' }, LOGOUT: { label: 'Logout', tone: 'neutral' },
  PASSWORD_CHANGE: { label: 'Ganti password', tone: 'brand' },
  REMINDER_CREATE: { label: 'Tambah reminder', tone: 'fresh' }, REMINDER_UPDATE: { label: 'Ubah reminder', tone: 'watch' },
  REMINDER_DELETE: { label: 'Hapus reminder', tone: 'expired' }, REMINDER_COMPLETE: { label: 'Reminder selesai', tone: 'brand' }, REMINDER_STATUS: { label: 'Status reminder', tone: 'watch' },
  DIVISION_CREATE: { label: 'Tambah unit kerja', tone: 'admin' }, DIVISION_UPDATE: { label: 'Ubah unit kerja', tone: 'admin' }, DIVISION_DELETE: { label: 'Hapus unit kerja', tone: 'expired' },
  USER_CREATE: { label: 'Tambah user', tone: 'admin' }, USER_UPDATE: { label: 'Ubah user', tone: 'admin' }, USER_DELETE: { label: 'Hapus user', tone: 'expired' },
  USER_PASSWORD_RESET: { label: 'Reset password user', tone: 'admin' }, USER_UNLOCK: { label: 'Buka kunci user', tone: 'admin' },
  BROADCAST: { label: 'Broadcast email', tone: 'admin' }, SETTING_UPDATE: { label: 'Ubah pengaturan', tone: 'admin' },
};
const actionBadge = (a: string) => { const x = ACTIONS[a] || { label: a, tone: 'neutral' as const }; return <Badge tone={x.tone}>{x.label}</Badge>; };

function DateRange({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return (
    <span className="row">
      <input type="date" className="input num" style={{ height: 36, width: 150 }} value={from} onChange={e => setFrom(e.target.value)} aria-label="Dari tanggal" />
      <span className="muted">–</span>
      <input type="date" className="input num" style={{ height: 36, width: 150 }} value={to} onChange={e => setTo(e.target.value)} aria-label="Sampai tanggal" />
    </span>
  );
}

export function ActivityLogPage() {
  const [from, setFrom] = useState(addDays(todayJkt(), -30));
  const [to, setTo] = useState(todayJkt());
  const [div, setDiv] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<ActivityLog | null>(null);
  const { data, error, loading, reload } = useLoad(() => call<{ logs: ActivityLog[] }>('logs.activity', { from, to, divisionId: div || undefined, action: action || undefined, limit: 1000 }), [from, to, div, action]);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data?.logs || []).filter(l => !n || [l.username, l.entityId, l.ip, l.device, JSON.stringify(l.detail)].join(' ').toLowerCase().includes(n));
  }, [data, q]);

  return (
    <>
      <div className="page-head"><div className="grow"><h1>Log aktivitas</h1><div className="sub">Jejak login dan setiap perubahan data, lengkap dengan perangkat dan IP. Hanya terlihat oleh superadmin.</div></div>
        <button className="btn" onClick={reload}><RefreshCw />Muat ulang</button></div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="panel">
        <div className="toolbar">
          <div className="search"><Search /><input className="input" placeholder="Cari user, IP, perangkat, isi…" value={q} onChange={e => setQ(e.target.value)} aria-label="Cari log" /></div>
          <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
          <DivisionSelect value={div} onChange={setDiv} />
          <select className="select" value={action} onChange={e => setAction(e.target.value)} aria-label="Jenis aksi">
            <option value="">Semua aksi</option>
            <option value="LOGIN">Login (berhasil & gagal)</option>
            <option value="REMINDER">Semua perubahan reminder</option>
            <option value="USER">Manajemen user</option>
            <option value="DIVISION">Manajemen unit kerja</option>
            <option value="BROADCAST">Broadcast email</option>
            <option value="PASSWORD_CHANGE">Ganti password</option>
            <option value="SETTING">Pengaturan</option>
          </select>
          <span className="spacer" /><span className="caption num">{rows.length} catatan</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Waktu</th><th>User</th><th>Unit kerja</th><th>Aksi</th><th>Objek</th><th>Perangkat</th><th>IP</th></tr></thead>
            {loading ? <SkeletonRows cols={7} /> : (
              <tbody>
                {rows.map(l => (
                  <tr key={l.id} className="clickable" onClick={() => setDetail(l)}>
                    <td className="num small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.at)}</td>
                    <td><div className="cell-title">{l.username || '—'}</div><div className="cell-sub">{l.role === 'SUPERADMIN' ? 'Superadmin' : l.role ? 'User' : 'Tidak dikenal'}</div></td>
                    <td>{l.divisionName || '—'}</td>
                    <td>{actionBadge(l.action)}</td>
                    <td className="small num">{l.entityId || '—'}</td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{l.device || '—'}</td>
                    <td className="small num">{l.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {!loading && !rows.length && <Empty icon={<FileClock />} title="Tidak ada aktivitas pada rentang tanggal dan filter ini." />}
      </div>
      {detail && (
        <Drawer title="Detail aktivitas" onClose={() => setDetail(null)}>
          <dl className="kv">
            <dt>Waktu</dt><dd className="num">{fmtDateTime(detail.at)}</dd>
            <dt>Aksi</dt><dd>{actionBadge(detail.action)}</dd>
            <dt>User</dt><dd>{detail.username || '—'} {detail.divisionName && <span className="muted">· {detail.divisionName}</span>}</dd>
            <dt>Objek</dt><dd className="num">{detail.entity} {detail.entityId}</dd>
            <dt>Perangkat</dt><dd>{detail.device}</dd>
            <dt>IP</dt><dd className="num">{detail.ip || '—'}</dd>
            <dt>User-Agent</dt><dd className="small muted">{detail.userAgent || '—'}</dd>
          </dl>
          <div><div className="label" style={{ marginBottom: 6 }}>Data perubahan</div><pre className="code">{JSON.stringify(detail.detail, null, 2)}</pre></div>
        </Drawer>
      )}
    </>
  );
}

export function NotificationLogPage() {
  const [from, setFrom] = useState(addDays(todayJkt(), -30));
  const [to, setTo] = useState(todayJkt());
  const [div, setDiv] = useState('');
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useLoad(() => call<{ logs: NotificationLog[] }>('logs.notifications', { from, to, divisionId: div || undefined, status: status || undefined, limit: 1000 }), [from, to, div, status]);
  const rows = data?.logs || [];
  return (
    <>
      <div className="page-head"><div className="grow"><h1>Log notifikasi</h1><div className="sub">Riwayat email dan pesan Telegram yang dikirim scheduler setiap pukul 09.00 WIB.</div></div>
        <button className="btn" onClick={reload}><RefreshCw />Muat ulang</button></div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="panel">
        <div className="toolbar">
          <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
          <DivisionSelect value={div} onChange={setDiv} />
          <select className="select" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status kirim">
            <option value="">Semua status</option><option value="SENT">Terkirim</option><option value="FAILED">Gagal</option><option value="SKIPPED">Dilewati</option>
          </select>
          <span className="spacer" /><span className="caption num">{rows.length} catatan</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Waktu</th><th>Reminder</th><th>Unit kerja</th><th>Channel</th><th>Penerima</th><th className="r">Sisa hari</th><th>Status</th></tr></thead>
            {loading ? <SkeletonRows cols={7} /> : (
              <tbody>
                {rows.map(l => (
                  <tr key={l.id}>
                    <td className="num small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.at)}</td>
                    <td><div className="cell-title">{l.name}</div><div className="cell-sub num">{l.uid}</div></td>
                    <td>{l.divisionName || '—'}</td>
                    <td>{l.channel === 'EMAIL' ? 'Email' : 'Telegram'}</td>
                    <td className="small" style={{ maxWidth: 260 }}>{l.recipient || '—'}</td>
                    <td className="r num">{l.daysRemaining}</td>
                    <td>{l.status === 'SENT' ? <Badge tone="fresh">Terkirim</Badge> : l.status === 'FAILED' ? <Badge tone="expired" title={l.error}>Gagal</Badge> : <Badge title={l.error}>Dilewati</Badge>}
                      {l.error && <div className="cell-sub">{l.error}</div>}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {!loading && !rows.length && <Empty icon={<Mail />} title="Belum ada notifikasi terkirim pada rentang ini. Scheduler hanya mengirim jika diaktifkan di Pengaturan." />}
      </div>
    </>
  );
}
