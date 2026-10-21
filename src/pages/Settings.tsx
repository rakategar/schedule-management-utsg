import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { call } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import type { Setting } from '../lib/types';
import { Confirm, ErrorBox, Switch, useLoad, useToast } from '../components/ui';

export function SettingsPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => call<{ settings: Setting[] }>('settings.get'), []);
  const map = Object.fromEntries((data?.settings || []).map(s => [s.key, s]));
  const [form, setForm] = useState({ DASHBOARD_URL: '', TELEGRAM_BOT_USERNAME: '', SESSION_HOURS: '', EMAIL_FROM: '' });
  const [confirmSched, setConfirmSched] = useState<boolean | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (data) setForm({ DASHBOARD_URL: map.DASHBOARD_URL?.value || '', TELEGRAM_BOT_USERNAME: map.TELEGRAM_BOT_USERNAME?.value || '', SESSION_HOURS: map.SESSION_HOURS?.value || '12', EMAIL_FROM: map.EMAIL_FROM?.value || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const save = async (key: string, value: string) => {
    setErr('');
    try { await call('settings.update', { key, value }); toast('Pengaturan tersimpan'); reload(); }
    catch (e) { setErr((e as Error).message); }
  };
  const sched = map.SCHEDULER_ENABLED?.value === 'true';

  return (
    <>
      <div className="page-head"><div><h1>Pengaturan</h1><div className="sub">Pengaturan sistem reminder untuk semua divisi.</div></div></div>
      {(error || err) && <ErrorBox>{error || err}</ErrorBox>}
      {!loading && (
        <div className="stack">
          <div className="panel panel-pad stack" style={{ boxShadow: `inset 3px 0 0 ${sched ? 'var(--fresh)' : 'var(--watch)'}` }}>
            <div className="row"><Clock size={18} /><h2 className="grow">Pengiriman otomatis 09.00 WIB</h2>
              <Switch checked={sched} onChange={v => setConfirmSched(v)} label="Aktifkan scheduler" /></div>
            <p className="muted" style={{ margin: 0 }}>{sched ? 'Aktif. Setiap hari pukul 09.00 WIB (ditambah jeda acak 1–7 menit), reminder yang jatuh pada hari pengingatnya dikirim lewat email dan Telegram.' : 'Mati. Tidak ada email atau pesan Telegram yang dikirim dari sistem baru.'}</p>
            {!sched && <div className="alert alert-warn"><AlertTriangle />Sebelum menyalakan, nonaktifkan workflow lama "Reminder - Schedule" di n8n supaya reminder tidak terkirim dua kali.</div>}
            <div className="caption">Terakhir diubah {fmtDateTime(map.SCHEDULER_ENABLED?.updatedAt)}{map.SCHEDULER_ENABLED?.updatedBy ? ` oleh ${map.SCHEDULER_ENABLED.updatedBy}` : ''}</div>
          </div>
          <div className="panel panel-pad stack">
            <h2>Umum</h2>
            {([
              ['DASHBOARD_URL', 'Alamat dashboard', 'Ditautkan di email reminder dan email broadcast, dan dipakai bot untuk membuat link /login Telegram.', 'https://reminder-utsg.vercel.app'],
              ['TELEGRAM_BOT_USERNAME', 'Username bot Telegram', 'Tanpa @. Ditampilkan di Profil supaya pengguna bisa membuka bot dan mengirim /start.', 'reminder_utsg_bot'],
              ['EMAIL_FROM', 'Pengirim email', 'Nama dan alamat pengirim, harus diizinkan oleh akun SMTP.', 'AI ICT UTSG <email@domain>'],
              ['SESSION_HOURS', 'Durasi sesi login (jam)', 'Setelah lewat, pengguna harus login lagi.', '12'],
            ] as const).map(([k, label, help, ph]) => (
              <div key={k} className="field">
                <label htmlFor={k}>{label}</label>
                <div className="row">
                  <input id={k} className="input grow" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph} />
                  <button className="btn" disabled={form[k] === (map[k]?.value || '')} onClick={() => save(k, form[k])}>Simpan</button>
                </div>
                <div className="help">{help}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {confirmSched !== null && (
        <Confirm title={confirmSched ? 'Nyalakan pengiriman otomatis?' : 'Matikan pengiriman otomatis?'}
          confirmLabel={confirmSched ? 'Nyalakan' : 'Matikan'} danger={!confirmSched}
          message={confirmSched ? 'Mulai besok pukul 09.00 WIB, sistem baru akan mengirim email dan Telegram ke semua divisi. Pastikan workflow lama sudah dinonaktifkan.' : 'Tidak ada reminder yang akan dikirim sampai dinyalakan lagi.'}
          onConfirm={() => save('SCHEDULER_ENABLED', String(confirmSched))} onClose={() => setConfirmSched(null)} />
      )}
    </>
  );
}
