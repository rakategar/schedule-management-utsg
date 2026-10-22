import { useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Plus } from 'lucide-react';
import { call } from '../lib/api';
import { FRESH_VAR, fmtDate, freshness } from '../lib/format';
import type { Reminder } from '../lib/types';
import { useSession } from '../session';
import { Empty, ErrorBox, StatusBadge, useLoad } from '../components/ui';
import { DivisionSelect, ReminderForm } from './Reminders';
import { TelegramPrompt } from './TelegramLink';

export function HomePage() {
  const { isSuper, go, user } = useSession();
  const [div, setDiv] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useLoad(() => call<{ today: string; reminders: Reminder[] }>('reminders.list', { divisionId: div || undefined }), [div]);
  const all = data?.reminders || [];
  const active = all.filter(r => r.status === 'ACTIVE');
  const count = (fn: (d: number) => boolean) => active.filter(r => r.daysLeft != null && fn(r.daysLeft)).length;
  const kpis = [
    { key: 'semua', label: 'Reminder aktif', val: active.length, tone: 'var(--brand)' },
    { key: 'hari-ini', label: 'Jatuh tempo hari ini', val: count(d => d === 0), tone: 'var(--expired)' },
    { key: '7', label: 'Dalam 7 hari', val: count(d => d >= 0 && d <= 7), tone: 'var(--critical)' },
    { key: '30', label: 'Dalam 30 hari', val: count(d => d >= 0 && d <= 30), tone: 'var(--watch)' },
    { key: 'lewat', label: 'Sudah lewat', val: count(d => d < 0), tone: 'var(--expired)' },
  ];
  const attention = active.filter(r => r.daysLeft != null && r.daysLeft <= 7);
  const upcoming = active.filter(r => r.daysLeft != null && r.daysLeft <= 30).slice(0, 12);
  const dots = active.slice(0, 40);

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>Beranda</h1>
          <div className="sub">{isSuper ? 'Ringkasan reminder semua divisi.' : `Ringkasan reminder divisi ${user.divisionName}.`}</div>
        </div>
        {isSuper && <DivisionSelect value={div} onChange={setDiv} />}
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus />Reminder baru</button>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <TelegramPrompt />

      <div className="panel panel-pad" style={{ marginBottom: 16, boxShadow: attention.length ? 'inset 3px 0 0 var(--critical)' : 'inset 3px 0 0 var(--fresh)' }}>
        {loading ? <div className="skel" style={{ height: 56 }} /> : attention.length ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row wrap" style={{ gap: 12 }}>
              <AlertTriangle size={20} color="var(--critical)" />
              <h2 className="grow">{attention.length} reminder perlu perhatian dalam 7 hari</h2>
              <button className="btn btn-sm" onClick={() => go('reminder?f=7')}>Lihat daftar <ArrowRight /></button>
            </div>
            <div className="dotbar" aria-label="Sebaran status reminder aktif">
              {dots.map(r => { const f = freshness(r); return <i key={r.uid} style={{ background: FRESH_VAR[f.key] }} title={`${r.name} — ${f.label} ${f.detail}`} />; })}
            </div>
            <div className="caption">Tiap titik adalah satu reminder aktif, diurutkan dari yang paling dekat jatuh tempo.</div>
          </div>
        ) : (
          <div className="row" style={{ gap: 12 }}>
            <CheckCircle2 size={20} color="var(--fresh)" />
            <div><h2>Tidak ada yang mendesak minggu ini</h2><div className="muted small">Semua reminder aktif masih lebih dari 7 hari sebelum jatuh tempo.</div></div>
          </div>
        )}
      </div>

      <div className="kpis" style={{ marginBottom: 16 }}>
        {kpis.map(k => (
          <button key={k.key} className="kpi" onClick={() => go(`reminder?f=${k.key}${div ? `&d=${div}` : ''}`)}>
            <span className="lbl"><span style={{ width: 8, height: 8, borderRadius: 2, background: k.tone }} />{k.label}</span>
            {loading ? <span className="skel" style={{ height: 28, width: 60 }} /> : <span className="val">{k.val}</span>}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head"><CalendarClock size={18} /><h3 className="grow">Jatuh tempo 30 hari ke depan</h3><button className="btn btn-sm btn-ghost" onClick={() => go('reminder?f=30')}>Semua <ArrowRight /></button></div>
        {!loading && !upcoming.length ? (
          <Empty icon={<CheckCircle2 />} title="Tidak ada reminder yang jatuh tempo dalam 30 hari ke depan." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Nama</th>{isSuper && <th>Divisi</th>}<th>Jatuh tempo</th><th>Status</th><th>Provider</th></tr></thead>
              <tbody>
                {(loading ? [] : upcoming).map(r => (
                  <tr key={r.uid} className={`clickable ${r.daysLeft != null && r.daysLeft <= 0 ? 'is-expired' : ''}`} onClick={() => go(`reminder?q=${encodeURIComponent(r.uid)}`)}>
                    <td><div className="cell-title">{r.name}</div><div className="cell-sub">{r.category || '—'}</div></td>
                    {isSuper && <td>{r.divisionName}</td>}
                    <td className="num">{fmtDate(r.dueDate)}</td>
                    <td><StatusBadge r={r} /></td>
                    <td className="muted">{r.provider || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && <ReminderForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
    </>
  );
}
