import type { Preset, Reminder } from './types';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Tanggal hari ini di WIB, format YYYY-MM-DD */
export const todayJkt = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
};

export const fmtLongToday = () => {
  const d = new Date(Date.now() + 7 * 3600e3);
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const monthTitle = (y: number, m: number) => `${BULAN_PANJANG[m]} ${y}`;

/** Waktu ISO → "21 Okt 2026, 14:05" (WIB) */
export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '—';
  const j = new Date(t.getTime() + 7 * 3600e3);
  return `${j.getUTCDate()} ${BULAN[j.getUTCMonth()]} ${j.getUTCFullYear()}, ${String(j.getUTCHours()).padStart(2, '0')}:${String(j.getUTCMinutes()).padStart(2, '0')}`;
};

export const addDays = (iso: string, n: number) => {
  const t = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b.slice(0, 10) + 'T00:00:00Z') - Date.parse(a.slice(0, 10) + 'T00:00:00Z')) / 864e5);

export type Fresh = 'fresh' | 'watch' | 'critical' | 'expired' | 'neutral';

/** Status kesegaran: Aman > 30 hari, Waspada 8–30, Kritis 1–7, Jatuh tempo ≤ 0 */
export function freshness(r: Pick<Reminder, 'status' | 'daysLeft'>): { key: Fresh; label: string; detail: string } {
  if (r.status === 'COMPLETED') return { key: 'neutral', label: 'Selesai', detail: '' };
  if (r.status === 'PAUSED') return { key: 'neutral', label: 'Dijeda', detail: '' };
  const d = r.daysLeft;
  if (d == null) return { key: 'neutral', label: 'Tanpa tanggal', detail: '' };
  if (d < 0) return { key: 'expired', label: 'Lewat', detail: `${-d} hari` };
  if (d === 0) return { key: 'expired', label: 'Jatuh tempo', detail: 'hari ini' };
  if (d <= 7) return { key: 'critical', label: 'Kritis', detail: `${d} hari` };
  if (d <= 30) return { key: 'watch', label: 'Waspada', detail: `${d} hari` };
  return { key: 'fresh', label: 'Aman', detail: `${d} hari` };
}

export const FRESH_VAR: Record<Fresh, string> = {
  fresh: 'var(--fresh)', watch: 'var(--watch)', critical: 'var(--critical)', expired: 'var(--expired)', neutral: 'var(--line-strong)',
};

export const PRESETS: Record<Exclude<Preset, 'CUSTOM'>, { label: string; days: number[]; hint: string }> = {
  STANDAR: { label: 'Standar', days: [30, 14, 7, 3, 1, 0], hint: 'H-30, H-14, H-7, H-3, H-1, dan hari H' },
  KETAT: { label: 'Ketat', days: Array.from({ length: 15 }, (_, i) => 14 - i), hint: 'Setiap hari dari H-14 sampai hari H' },
  PANJANG: { label: 'Jangka panjang', days: [90, 60, 30, 14, 7, 1], hint: 'H-90, H-60, H-30, H-14, H-7, H-1' },
};

/** Hari preset yang tanggalnya belum lewat. Kalau semuanya sudah lewat, sisakan hari H. */
export const upcomingPresetDays = (p: Exclude<Preset, 'CUSTOM'>, dueDate: string) => {
  const today = todayJkt();
  const days = PRESETS[p].days.filter(d => addDays(dueDate, -d) >= today);
  return days.length ? days : [0];
};

export const presetLabel = (p: Preset) => (p === 'CUSTOM' ? 'Kustom' : PRESETS[p].label);

export const summarizeDays = (days: number[]) => {
  if (!days.length) return '—';
  const s = [...days].sort((a, b) => b - a);
  return `${s.length} jadwal · H-${s[0]}${s.length > 1 ? ` … ${s[s.length - 1] === 0 ? 'hari H' : 'H-' + s[s.length - 1]}` : ''}`;
};

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]!.toUpperCase()).join('') || '?';
