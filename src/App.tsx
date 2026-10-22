import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Building2, ChevronDown, FileClock, Home, LayoutGrid, LogOut, Mail, Moon, Send, Settings as SettingsIcon, Sun, User as UserIcon, Users as UsersIcon, Loader2,
} from 'lucide-react';
import { auth, call } from './lib/api';
import { fmtLongToday, initials } from './lib/format';
import type { DivisionRef, Session, User } from './lib/types';
import { DEFAULT_TELEGRAM_BOT, SessionCtx, type SessionValue } from './session';
import { ToastProvider } from './components/ui';
import { ForceResetPage, LoginPage } from './pages/Login';
import { HomePage } from './pages/Home';
import { RemindersPage } from './pages/Reminders';
import { ProfilePage } from './pages/Profile';
import { DivisionsPage } from './pages/Divisions';
import { UsersPage } from './pages/Users';
import { BroadcastPage } from './pages/Broadcast';
import { ActivityLogPage, NotificationLogPage } from './pages/Logs';
import { SettingsPage } from './pages/Settings';
import { TelegramLinkPage } from './pages/TelegramLink';

type Route = { name: string; params: URLSearchParams };
const parseHash = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [name, q] = h.split('?');
  return { name: name || 'beranda', params: new URLSearchParams(q || '') };
};

const NAV = [
  { name: 'beranda', label: 'Beranda', icon: Home },
  { name: 'reminder', label: 'Reminder', icon: Bell },
];
const ADMIN_NAV = [
  { name: 'divisi', label: 'Divisi', icon: Building2 },
  { name: 'pengguna', label: 'Pengguna', icon: UsersIcon },
  { name: 'broadcast', label: 'Broadcast email', icon: Send },
  { name: 'log', label: 'Log aktivitas', icon: FileClock },
  { name: 'notifikasi', label: 'Log notifikasi', icon: Mail },
  { name: 'pengaturan', label: 'Pengaturan', icon: SettingsIcon },
];

function useTheme() {
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem('nr_theme') || ''; } catch { return ''; } });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
    try { theme ? localStorage.setItem('nr_theme', theme) : localStorage.removeItem('nr_theme'); } catch { /* abaikan */ }
  }, [theme]);
  const dark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { dark, toggle: () => setTheme(dark ? 'light' : 'dark') };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [divisions, setDivisions] = useState<DivisionRef[]>([]);
  const [telegramBot, setTelegramBot] = useState(DEFAULT_TELEGRAM_BOT);
  const [booting, setBooting] = useState(!!auth.token);
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const h = () => setRoute(parseHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const logoutLocal = useCallback(() => { auth.setToken(null); setUser(null); }, []);
  useEffect(() => { auth.onUnauthorized(logoutLocal); }, [logoutLocal]);

  useEffect(() => {
    if (!auth.token) return;
    call<Omit<Session, 'token'>>('auth.me')
      .then(r => { setUser(r.user); setDivisions(r.divisions); setTelegramBot(r.telegramBot || DEFAULT_TELEGRAM_BOT); })
      .catch(() => auth.setToken(null))
      .finally(() => setBooting(false));
  }, []);

  const onLogin = (s: Session) => { setUser(s.user); setDivisions(s.divisions); setTelegramBot(s.telegramBot || DEFAULT_TELEGRAM_BOT); if (!window.location.hash) window.location.hash = '#/beranda'; };
  const logout = useCallback(async () => {
    try { await call('auth.logout'); } catch { /* sesi mungkin sudah berakhir */ }
    logoutLocal();
  }, [logoutLocal]);

  const refresh = useCallback(async () => {
    const r = await call<Omit<Session, 'token'>>('auth.me');
    setUser(r.user); setDivisions(r.divisions); setTelegramBot(r.telegramBot || DEFAULT_TELEGRAM_BOT);
  }, []);

  if (booting) return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><Loader2 className="spin" /></div>;

  return (
    <ToastProvider>
      {!user ? <LoginPage onLogin={onLogin} linkingTelegram={route.name === 'tautkan-telegram'} />
        : user.mustResetPassword ? <ForceResetPage user={user} onDone={setUser} onLogout={logout} />
          : <Shell user={user} divisions={divisions} telegramBot={telegramBot} setUser={setUser} logout={logout} refresh={refresh} route={route} />}
    </ToastProvider>
  );
}

function Shell({ user, divisions, telegramBot, setUser, logout, refresh, route }: { user: User; divisions: DivisionRef[]; telegramBot: string; setUser: (u: User) => void; logout: () => void; refresh: () => Promise<void>; route: Route }) {
  const isSuper = user.role === 'SUPERADMIN';
  const go = useCallback((r: string) => { window.location.hash = '#/' + r; }, []);
  const value = useMemo<SessionValue>(() => ({ user, divisions, isSuper, setUser, logout, go, refresh, telegramBot }), [user, divisions, isSuper, setUser, logout, go, refresh, telegramBot]);
  const theme = useTheme();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const allowed = new Set(['beranda', 'reminder', 'profil', 'tautkan-telegram', ...(isSuper ? ['admin', ...ADMIN_NAV.map(n => n.name)] : [])]);
  const name = allowed.has(route.name) ? route.name : 'beranda';
  useEffect(() => { window.scrollTo(0, 0); }, [name]);

  let page: React.ReactNode;
  switch (name) {
    case 'reminder': page = <RemindersPage params={route.params} />; break;
    case 'profil': page = <ProfilePage dark={theme.dark} toggleTheme={theme.toggle} />; break;
    case 'divisi': page = <DivisionsPage />; break;
    case 'pengguna': page = <UsersPage />; break;
    case 'broadcast': page = <BroadcastPage />; break;
    case 'log': page = <ActivityLogPage />; break;
    case 'notifikasi': page = <NotificationLogPage />; break;
    case 'pengaturan': page = <SettingsPage />; break;
    case 'admin': page = <AdminHub />; break;
    case 'tautkan-telegram': page = <TelegramLinkPage token={route.params.get('t') || ''} />; break;
    default: page = <HomePage />;
  }

  const NavBtn = ({ n }: { n: { name: string; label: string; icon: typeof Home } }) => (
    <button className="nav-item" aria-current={name === n.name ? 'page' : undefined} onClick={() => go(n.name)} title={n.label}>
      <n.icon /><span className="lbl">{n.label}</span>
    </button>
  );

  return (
    <SessionCtx.Provider value={value}>
      <div className="app" style={{ ['--rail' as string]: isSuper ? 'var(--role-admin)' : 'var(--role-user)' }}>
        <header className="topbar">
          <div className="brandmark"><img src="/logo-usg.png" alt="UTSG" width={52} height={24} /><span className="sep" aria-hidden /><span>Reminder</span></div>
          <span className="today muted small">{fmtLongToday()}</span>
          <div className="userbox" ref={menuRef} style={{ position: 'relative' }}>
            <button className="btn btn-ghost" onClick={() => setMenu(m => !m)} aria-haspopup="menu" aria-expanded={menu} style={{ height: 40, gap: 10 }}>
              <span className="avatar" aria-hidden>{initials(user.fullName || user.username)}</span>
              <span className="uname" style={{ textAlign: 'left', lineHeight: '16px' }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{user.fullName || user.username}</span>
                <span className="caption">{isSuper ? 'Superadmin' : user.divisionName}</span>
              </span>
              <ChevronDown size={16} />
            </button>
            {menu && (
              <div className="menu" role="menu">
                <button role="menuitem" onClick={() => { setMenu(false); go('profil'); }}><UserIcon />Profil & password</button>
                <button role="menuitem" onClick={() => { setMenu(false); theme.toggle(); }}>{theme.dark ? <Sun /> : <Moon />}{theme.dark ? 'Mode terang' : 'Mode gelap'}</button>
                <button role="menuitem" className="danger" onClick={() => { setMenu(false); logout(); }}><LogOut />Keluar</button>
              </div>
            )}
          </div>
        </header>
        <nav className="sidebar" aria-label="Navigasi utama">
          {NAV.map(n => <NavBtn key={n.name} n={n} />)}
          {isSuper && <><div className="nav-sec">Administrasi</div>{ADMIN_NAV.map(n => <NavBtn key={n.name} n={n} />)}</>}
          <div className="nav-sec">Akun</div>
          <NavBtn n={{ name: 'profil', label: 'Profil', icon: UserIcon }} />
        </nav>
        <main className="main">{page}</main>
        <nav className="tabbar" aria-label="Navigasi">
          {[...NAV, ...(isSuper ? [{ name: 'admin', label: 'Admin', icon: LayoutGrid }] : []), { name: 'profil', label: 'Profil', icon: UserIcon }].map(n => (
            <button key={n.name} aria-current={name === n.name || (n.name === 'admin' && ADMIN_NAV.some(a => a.name === name)) ? 'page' : undefined} onClick={() => go(n.name)}>
              <n.icon />{n.label}
            </button>
          ))}
        </nav>
      </div>
    </SessionCtx.Provider>
  );
}

function AdminHub() {
  const go = (r: string) => { window.location.hash = '#/' + r; };
  return (
    <>
      <div className="page-head"><div><h1>Administrasi</h1><div className="sub">Kelola divisi, pengguna, dan pantau aktivitas.</div></div></div>
      <div className="panel">
        {ADMIN_NAV.map(n => (
          <button key={n.name} className="nav-item" style={{ height: 52, borderBottom: '1px solid var(--line)', borderRadius: 0, color: 'var(--ink)' }} onClick={() => go(n.name)}>
            <n.icon />{n.label}
          </button>
        ))}
      </div>
    </>
  );
}
