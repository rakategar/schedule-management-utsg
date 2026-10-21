import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { addDays, daysBetween, fmtDate, monthTitle, todayJkt } from '../lib/format';

const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/**
 * Kalender multi-tanggal untuk memilih hari pengingat.
 * Nilai disimpan sebagai offset H-n terhadap tanggal jatuh tempo.
 */
export function MultiDatePicker({ dueDate, days, onChange }: { dueDate: string; days: number[]; onChange: (days: number[]) => void }) {
  const today = todayJkt();
  const start = days.length ? addDays(dueDate, -Math.max(...days)) : dueDate;
  const initial = (start < today && dueDate >= today ? today : start).slice(0, 7);
  const [ym, setYm] = useState(initial);
  const [y, m] = ym.split('-').map(Number);
  const selected = useMemo(() => new Set(days), [days]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(y, m - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const startIso = addDays(first.toISOString().slice(0, 10), -lead);
    return Array.from({ length: 42 }, (_, i) => addDays(startIso, i));
  }, [y, m]);

  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setYm(d.toISOString().slice(0, 7));
  };

  const toggle = (iso: string) => {
    const off = daysBetween(iso, dueDate);
    if (off < 0) return;
    const next = new Set(selected);
    next.has(off) ? next.delete(off) : next.add(off);
    onChange([...next].sort((a, b) => b - a));
  };

  const sorted = [...days].sort((a, b) => b - a);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="cal">
        <div className="cal-head">
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => shift(-1)} aria-label="Bulan sebelumnya"><ChevronLeft /></button>
          <strong className="grow" style={{ textAlign: 'center' }}>{monthTitle(y, m - 1)}</strong>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => shift(1)} aria-label="Bulan berikutnya"><ChevronRight /></button>
        </div>
        <div className="cal-grid" role="grid">
          {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
          {cells.map(iso => {
            const off = daysBetween(iso, dueDate);
            const isSel = off >= 0 && selected.has(off);
            const cls = ['cal-day', iso.slice(0, 7) !== ym && 'out', iso < today && 'past', iso === today && 'today', isSel && 'sel', iso === dueDate && 'due'].filter(Boolean).join(' ');
            return (
              <button key={iso} type="button" className={cls} disabled={off < 0} onClick={() => toggle(iso)}
                aria-pressed={isSel} aria-label={`${fmtDate(iso)}${iso === dueDate ? ', jatuh tempo' : ''}${off >= 0 ? `, H-${off}` : ''}`}
                title={off >= 0 ? (off === 0 ? 'Hari H (jatuh tempo)' : `H-${off}`) : 'Setelah jatuh tempo'}>
                {Number(iso.slice(8))}
              </button>
            );
          })}
        </div>
        <div className="cal-legend">
          <span><i style={{ background: 'var(--brand)' }} />Diingatkan</span>
          <span><i style={{ background: 'var(--expired-bg)', boxShadow: 'inset 0 0 0 1px var(--expired)' }} />Jatuh tempo</span>
          <span><i style={{ boxShadow: 'inset 0 0 0 1px var(--line-strong)' }} />Hari ini</span>
        </div>
      </div>
      {sorted.length > 0 ? (
        <div className="daychips" aria-label="Hari pengingat terpilih">
          {sorted.map(d => {
            const iso = addDays(dueDate, -d);
            return (
              <span key={d} className="daychip" style={iso < today ? { opacity: .55 } : undefined} title={iso < today ? 'Tanggal ini sudah lewat' : undefined}>
                {d === 0 ? 'Hari H' : `H-${d}`} · {fmtDate(iso)}
                <button type="button" onClick={() => onChange(sorted.filter(x => x !== d))} aria-label={`Hapus H-${d}`}><X /></button>
              </span>
            );
          })}
        </div>
      ) : <div className="help">Klik tanggal di kalender untuk menambah hari pengingat.</div>}
    </div>
  );
}
