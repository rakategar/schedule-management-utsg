import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, X } from 'lucide-react';
import { freshness, type Fresh } from '../lib/format';
import type { Reminder } from '../lib/types';

export function Badge({ tone = 'neutral', children, dot = true, title }: { tone?: Fresh | 'brand' | 'admin'; children: ReactNode; dot?: boolean; title?: string }) {
  return <span className={`badge b-${tone}`} title={title}>{dot && <span className="dot" aria-hidden />}{children}</span>;
}

export function StatusBadge({ r }: { r: Pick<Reminder, 'status' | 'daysLeft'> }) {
  const f = freshness(r);
  return (
    <span className={`badge b-${f.key}`} aria-label={`${f.label} ${f.detail}`.trim()}>
      <span className="dot" aria-hidden />{f.label}{f.detail && <span className="num" style={{ fontWeight: 400 }}>{f.detail}</span>}
    </span>
  );
}

export function Modal({ title, onClose, children, footer, size }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'lg' }) {
  useEscape(onClose);
  return (
    <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${size || ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-head"><h2 className="grow">{title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Tutup"><X /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="backdrop drawer-wrap" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="modal-head"><h2 className="grow">{title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Tutup"><X /></button></div>
        <div className="modal-body">{children}</div>
      </aside>
    </div>
  );
}

function useEscape(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

export function Confirm({ title, message, confirmLabel, danger, onConfirm, onClose, children }: {
  title: string; message: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<void> | void; onClose: () => void; children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose} disabled={busy}>Batal</button>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={async () => {
        setBusy(true); setErr('');
        try { await onConfirm(); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); }
      }}>{busy ? 'Memproses…' : confirmLabel}</button>
    </>}>
      <p style={{ margin: 0 }}>{message}</p>
      {children}
      {err && <ErrorBox>{err}</ErrorBox>}
    </Modal>
  );
}

export const ErrorBox = ({ children }: { children: ReactNode }) => (
  <div className="alert alert-error" role="alert"><AlertTriangle />{children}</div>
);

export function Empty({ icon, title, action }: { icon?: ReactNode; title: ReactNode; action?: ReactNode }) {
  return <div className="empty">{icon || <Inbox />}<div>{title}</div>{action}</div>;
}

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return <tbody>{Array.from({ length: rows }, (_, i) => <tr key={i}>{Array.from({ length: cols }, (_, j) => <td key={j}><div className="skel" style={{ height: 12, width: j === 0 ? '70%' : '50%' }} /></td>)}</tr>)}</tbody>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="switch"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label} /><span /></label>;
}

// ===== Toast =====
type Toast = { id: number; text: string; err?: boolean };
const ToastCtx = createContext<(text: string, err?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, err?: boolean) => {
    const id = Date.now() + Math.random();
    setItems(x => [...x, { id, text, err }]);
    setTimeout(() => setItems(x => x.filter(t => t.id !== id)), err ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map(t => <div key={t.id} className={`toast ${t.err ? 'err' : ''}`}>{t.err ? <AlertTriangle /> : <CheckCircle2 />}{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/** Ambil data dengan status loading/error, bisa dimuat ulang */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    fn().then(d => { if (alive) setData(d); }).catch(e => { if (alive) setError((e as Error).message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick(t => t + 1), setData };
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
