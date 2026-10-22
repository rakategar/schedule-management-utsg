import { createContext, useContext } from 'react';
import type { DivisionRef, User } from './lib/types';

export interface SessionValue {
  user: User;
  divisions: DivisionRef[];
  isSuper: boolean;
  setUser: (u: User) => void;
  logout: () => void;
  go: (route: string) => void;
  refresh: () => Promise<void>;
  /** Username bot Telegram dari NR_Settings (tanpa @), kosong kalau belum diatur */
  telegramBot: string;
}

/** Bot Telegram resmi; dipakai kalau NR_Settings belum diisi */
export const DEFAULT_TELEGRAM_BOT = 'reminder_utsg_bot';

export const SessionCtx = createContext<SessionValue | null>(null);
export const useSession = () => {
  const v = useContext(SessionCtx);
  if (!v) throw new Error('SessionCtx kosong');
  return v;
};
