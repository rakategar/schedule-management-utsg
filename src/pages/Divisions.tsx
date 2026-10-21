import { useState } from 'react';
import { Building2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { call } from '../lib/api';
import type { Division } from '../lib/types';
import { useSession } from '../session';
import { Badge, Confirm, Empty, ErrorBox, Modal, SkeletonRows, Switch, useLoad, useToast } from '../components/ui';

export function DivisionsPage() {
  const toast = useToast();
  const { refresh } = useSession();
  const { data, error, loading, reload: reloadList } = useLoad(() => call<{ divisions: Division[] }>('divisions.list'), []);
  const reload = () => { reloadList(); refresh().catch(() => {}); };
  const [editing, setEditing] = useState<Division | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Division | null>(null);
  const rows = data?.divisions || [];

  return (
    <>
      <div className="page-head">
        <div className="grow"><h1>Divisi</h1><div className="sub">Setiap divisi hanya bisa melihat dan mengelola reminder miliknya.</div></div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus />Divisi baru</button>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Kode</th><th>Nama divisi</th><th>Telegram</th><th className="r">User</th><th className="r">Reminder aktif</th><th>Status</th><th aria-label="Aksi" /></tr></thead>
            {loading ? <SkeletonRows cols={7} rows={8} /> : (
              <tbody>
                {rows.map(d => (
                  <tr key={d.id}>
                    <td className="num">{d.code}</td>
                    <td><div className="cell-title">{d.name}</div>{d.defaultRecipients && <div className="cell-sub">{d.defaultRecipients}</div>}</td>
                    <td>{d.telegramChatId ? <span className="row num small"><Send size={14} />{d.telegramChatId}</span> : <span className="faint small">Belum diisi</span>}</td>
                    <td className="r num">{d.userCount}</td>
                    <td className="r num">{d.reminderCount}</td>
                    <td>{d.isActive ? <Badge tone="fresh">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(d)} aria-label={`Ubah ${d.name}`}><Pencil /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleting(d)} aria-label={`Hapus ${d.name}`}><Trash2 /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {!loading && !rows.length && <Empty icon={<Building2 />} title="Belum ada divisi. Tambahkan divisi pertama untuk mulai membagi reminder." />}
      </div>
      {editing && <DivisionForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); toast('Divisi tersimpan'); }} />}
      {deleting && (
        <Confirm title="Hapus divisi?" danger confirmLabel="Hapus divisi"
          message={<>Divisi <b>{deleting.name}</b> akan dinonaktifkan dan disembunyikan. Riwayat reminder dan log tetap tersimpan.</>}
          onConfirm={async () => { await call('divisions.delete', { id: deleting.id }); toast('Divisi dihapus'); reload(); }}
          onClose={() => setDeleting(null)} />
      )}
    </>
  );
}

function DivisionForm({ initial, onClose, onSaved }: { initial?: Division; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    code: initial?.code ?? '', name: initial?.name ?? '', telegramChatId: initial?.telegramChatId ?? '',
    defaultRecipients: initial?.defaultRecipients ?? '', isActive: initial?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true); setErr('');
    try { await call(initial ? 'divisions.update' : 'divisions.create', { ...f, id: initial?.id }); onSaved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Modal title={initial ? `Ubah divisi ${initial.name}` : 'Divisi baru'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn btn-primary" onClick={save} disabled={busy || !f.code || !f.name}>{busy ? 'Menyimpan…' : 'Simpan divisi'}</button>
    </>}>
      <div className="form-grid">
        <div className="field"><label className="req" htmlFor="dc">Kode</label><input id="dc" className="input num" value={f.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="UNIT11" /></div>
        <div className="field"><label className="req" htmlFor="dn">Nama divisi</label><input id="dn" className="input" value={f.name} onChange={e => set('name', e.target.value)} /></div>
        <div className="field full"><label htmlFor="dt">Telegram Chat ID grup</label><input id="dt" className="input num" value={f.telegramChatId} onChange={e => set('telegramChatId', e.target.value)} placeholder="-1001234567890" />
          <div className="help">Tambahkan bot reminder ke grup Telegram divisi, lalu isi Chat ID grupnya. Kosongkan kalau divisi tidak memakai Telegram.</div></div>
        <div className="field full"><label htmlFor="dr">Penerima email default</label><textarea id="dr" className="textarea" style={{ minHeight: 56 }} value={f.defaultRecipients} onChange={e => set('defaultRecipients', e.target.value)} placeholder="atasan@sig.id, tim@sig.id" />
          <div className="help">Dipakai sebagai penerima awal saat reminder baru dibuat tanpa penerima.</div></div>
        <div className="full row"><Switch checked={f.isActive} onChange={v => set('isActive', v)} label="Divisi aktif" /><span>Divisi aktif</span></div>
      </div>
      {err && <ErrorBox>{err}</ErrorBox>}
    </Modal>
  );
}
