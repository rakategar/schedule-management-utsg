import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Link2, Loader2, Send, Unlink } from 'lucide-react';
import { call } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import type { TelegramAccount, User } from '../lib/types';
import { useSession } from '../session';
import { Confirm, ErrorBox, useToast } from '../components/ui';

const tgLabel = (t: TelegramAccount) => (t.username ? `@${t.username}` : t.name || 'Telegram');

/** Halaman tujuan link dari perintah /login di bot: konfirmasi dulu sebelum menautkan */
export function TelegramLinkPage({ token }: { token: string }) {
  const { user, setUser, go } = useSession();
  const [state, setState] = useState<'loading' | 'confirm' | 'done' | 'error'>(token ? 'loading' : 'error');
  const [preview, setPreview] = useState<{ telegram: TelegramAccount; expiresAt: string; replaces: TelegramAccount | null } | null>(null);
  const [err, setErr] = useState(token ? '' : 'Link tidak lengkap. Ketik /login di bot Telegram untuk membuat link baru.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    call<{ telegram: TelegramAccount; expiresAt: string; replaces: TelegramAccount | null }>('telegram.preview', { linkToken: token })
      .then(p => { setPreview(p); setState('confirm'); })
      .catch(e => { setErr((e as Error).message); setState('error'); });
  }, [token]);

  const link = async () => {
    setBusy(true); setErr('');
    try {
      const r = await call<{ user: User }>('telegram.link', { linkToken: token });
      setUser(r.user); setState('done');
      // token sudah terpakai, buang dari alamat supaya tidak tersimpan di riwayat
      window.history.replaceState(null, '', '#/tautkan-telegram');
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <div className="page-head"><div><h1>Hubungkan Telegram</h1><div className="sub">Tautkan akun Telegram ke akun dashboard {user.username}.</div></div></div>
      <div className="panel panel-pad stack" style={{ maxWidth: 560 }}>
        {state === 'loading' && <div className="row muted"><Loader2 className="spin" size={18} />Memeriksa link…</div>}
        {state === 'error' && (
          <>
            <div className="row"><AlertTriangle size={20} style={{ color: 'var(--expired)' }} /><h2 className="grow">Link tidak bisa dipakai</h2></div>
            <ErrorBox>{err}</ErrorBox>
            <div><button className="btn" onClick={() => go('profil')}>Ke Profil</button></div>
          </>
        )}
        {state === 'confirm' && preview && (
          <>
            <div className="row"><Send size={20} style={{ color: 'var(--brand)' }} /><h2 className="grow">Hubungkan akun ini?</h2></div>
            <dl className="kv">
              <dt>Telegram</dt><dd><b>{tgLabel(preview.telegram)}</b>{preview.telegram.username && preview.telegram.name ? ` · ${preview.telegram.name}` : ''}</dd>
              <dt>Akun dashboard</dt><dd className="num">{user.username}</dd>
              <dt>Link berlaku sampai</dt><dd>{fmtDateTime(preview.expiresAt)}</dd>
            </dl>
            {preview.replaces && <div className="alert alert-warn"><AlertTriangle />Akun ini sekarang terhubung ke {tgLabel(preview.replaces)}. Tautan lama akan diganti.</div>}
            <div className="alert alert-info"><AlertTriangle />Pastikan akun Telegram di atas milikmu. Jangan lanjutkan kalau link ini dikirim oleh orang lain.</div>
            {err && <ErrorBox>{err}</ErrorBox>}
            <div className="row">
              <button className="btn btn-primary" onClick={link} disabled={busy}><Link2 />{busy ? 'Menghubungkan…' : 'Hubungkan Telegram'}</button>
              <button className="btn" onClick={() => go('beranda')} disabled={busy}>Batal</button>
            </div>
          </>
        )}
        {state === 'done' && (
          <>
            <div className="row"><CheckCircle2 size={20} style={{ color: 'var(--fresh)' }} /><h2 className="grow">Telegram terhubung</h2></div>
            <p className="muted" style={{ margin: 0 }}>Akun {user.telegram ? tgLabel(user.telegram) : 'Telegram'} sekarang dikenali bot. Kirim /start di bot untuk memastikan.</p>
            <div><button className="btn btn-primary" onClick={() => go('beranda')}>Ke Beranda</button></div>
          </>
        )}
      </div>
    </>
  );
}

/** Kartu status Telegram di halaman Profil */
export function TelegramCard() {
  const { user, setUser, telegramBot } = useSession();
  const toast = useToast();
  const [unlinking, setUnlinking] = useState(false);
  const tg = user.telegram;
  const botUrl = telegramBot ? `https://t.me/${telegramBot}` : '';

  return (
    <div className="panel panel-pad stack">
      <div className="row"><Send size={18} /><h2 className="grow">Telegram</h2></div>
      {tg ? (
        <>
          <dl className="kv">
            <dt>Akun</dt><dd><b>{tgLabel(tg)}</b>{tg.username && tg.name ? ` · ${tg.name}` : ''}</dd>
            <dt>Terhubung sejak</dt><dd>{fmtDateTime(tg.linkedAt)}</dd>
          </dl>
          <div><button className="btn" onClick={() => setUnlinking(true)}><Unlink />Putuskan Telegram</button></div>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>Belum terhubung. Hubungkan supaya bot reminder mengenali akunmu.</p>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4, fontSize: 13 }}>
            <li>Buka bot {telegramBot ? <b>@{telegramBot}</b> : 'reminder'} di Telegram, lalu kirim <code>/start</code>.</li>
            <li>Kirim <code>/login</code>. Bot membalas dengan link yang berlaku 10 menit.</li>
            <li>Buka link itu, lalu tekan <b>Hubungkan Telegram</b>.</li>
          </ol>
          {botUrl && <div><a className="btn btn-primary" href={botUrl} target="_blank" rel="noreferrer"><ExternalLink />Buka @{telegramBot}</a></div>}
        </>
      )}
      {unlinking && (
        <Confirm title="Putuskan Telegram?" danger confirmLabel="Putuskan"
          message={<>Bot tidak akan mengenali {tg ? <b>{tgLabel(tg)}</b> : 'akun Telegram ini'} lagi sampai kamu menghubungkannya ulang lewat /login.</>}
          onConfirm={async () => { const r = await call<{ user: User }>('telegram.unlink'); setUser(r.user); toast('Telegram diputus'); }}
          onClose={() => setUnlinking(false)} />
      )}
    </div>
  );
}
