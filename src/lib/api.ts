// Klien API ke webhook n8n workflow "new reminder"
const API_URL = import.meta.env.VITE_API_URL as string;
const TOKEN_KEY = 'nr_token';

export class ApiError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const store = {
  get(): string | null { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(v: string | null) { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage diblokir */ } },
};

let token: string | null = store.get();
let onUnauthorized: () => void = () => {};

export const auth = {
  get token() { return token; },
  setToken(v: string | null) { token = v; store.set(v); },
  onUnauthorized(fn: () => void) { onUnauthorized = fn; },
};

export async function call<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    // text/plain → request "simple", tidak perlu preflight CORS
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action, token, payload }),
    });
  } catch {
    throw new ApiError('Server tidak bisa dihubungi. Periksa koneksi internet lalu coba lagi.', 0);
  }
  let body: { ok?: boolean; data?: T; error?: string; code?: string | null } | null = null;
  try { body = await res.json(); } catch { body = null; }
  if (!body) throw new ApiError(`Server membalas tanpa data (HTTP ${res.status}).`, res.status);
  if (!body.ok) {
    if (res.status === 401 && action !== 'auth.login') onUnauthorized();
    throw new ApiError(body.error || 'Permintaan gagal.', res.status, body.code ?? null);
  }
  return body.data as T;
}
