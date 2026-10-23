export type Role = 'SUPERADMIN' | 'USER';

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: Role;
  divisionId: number | null;
  divisionName: string | null;
  mustResetPassword: boolean;
  isActive: boolean;
  locked: boolean;
  failedLoginCount: number;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  createdAt: string | null;
  telegram: TelegramAccount | null;
  /** Email pribadi yang ikut menerima reminder unit kerja */
  reminderEmails: string[];
}

export interface TelegramAccount { username: string; name: string; linkedAt?: string | null; }

export interface DivisionRef { id: number; code: string; name: string; isActive: boolean; hasTelegram: boolean; }

export interface Division {
  id: number; code: string; name: string; telegramChatId: string; defaultRecipients: string;
  isActive: boolean; userCount: number; reminderCount: number; createdAt: string | null; updatedAt: string | null;
}

export type Preset = 'STANDAR' | 'KETAT' | 'PANJANG' | 'CUSTOM';
export type Status = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type Recurrence = 'NONE' | 'MONTHLY' | 'YEARLY';

export interface Reminder {
  rowId: number | null; uid: string; version: number;
  divisionId: number; divisionName: string; divisionHasTelegram: boolean;
  name: string; category: string; provider: string; description: string;
  dueDate: string | null; daysLeft: number | null;
  preset: Preset; reminderDays: number[];
  channelEmail: boolean; channelTelegram: boolean; recipients: string;
  status: Status; isRecurring: boolean; recurrenceType: Recurrence; lastCompletedDate: string | null;
  isUpdated: boolean; isDeleted: boolean; changeNote: string;
  createdBy: string | null; createdAt: string | null; updatedBy: string | null; updatedAt: string | null;
  deletedBy: string | null; deletedAt: string | null;
}

export interface ActivityLog {
  id: number; at: string; userId: number | null; username: string; role: string;
  divisionId: number | null; divisionName: string | null; action: string; entity: string; entityId: string;
  detail: unknown; ip: string; device: string; userAgent: string;
}

export interface NotificationLog {
  id: number; at: string; uid: string; name: string; divisionId: number; divisionName: string | null;
  channel: string; recipient: string; daysRemaining: number; status: string; error: string;
}

export interface Setting { key: string; value: string; updatedAt: string | null; updatedBy: string | null; }

export interface Session { token: string; user: User; divisions: DivisionRef[]; telegramBot: string; }
