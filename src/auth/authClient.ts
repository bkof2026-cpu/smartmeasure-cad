// ─────────────────────────────────────────────────────────────────────────────
// Thin client for the /api/auth/* + /api/profile/* + /api/drawings routes.
// Every function here is the ONLY place in the frontend that talks to these
// endpoints, so token storage/header conventions stay in one spot.
// ─────────────────────────────────────────────────────────────────────────────

export const EMPLOYEE_TOKEN_KEY = 'sm_session_token';
export const EMPLOYEE_LAST_LOGIN_KEY = 'sm_last_login';
export const ADMIN_TOKEN_KEY = 'sm_admin_session_token';

export interface LastLogin {
  id: string;
  name: string;
}

export interface SessionUser {
  id: string;
  name: string;
  role: 'employee' | 'manager' | 'ceo';
  email: string | null;
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || `Request failed (${res.status}).` };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'Network error — check your connection and try again.' };
  }
}

async function getJson<T>(path: string, token: string | null): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || `Request failed (${res.status}).` };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'Network error — check your connection and try again.' };
  }
}

// ─── Employee auth ──────────────────────────────────────────────────────────

export async function employeeLogin(id: string) {
  return postJson<{ token: string; id: string; name: string }>('/api/auth/employee-login', { id });
}

export function getEmployeeToken(): string | null {
  try { return localStorage.getItem(EMPLOYEE_TOKEN_KEY); } catch { return null; }
}

export function setEmployeeToken(token: string) {
  try { localStorage.setItem(EMPLOYEE_TOKEN_KEY, token); } catch { /* ignore quota errors */ }
}

export function clearEmployeeToken() {
  try { localStorage.removeItem(EMPLOYEE_TOKEN_KEY); } catch { /* ignore */ }
}

/** Read the last-logged-in employee for the "Continue as {name}" chip —
 * deliberately NOT cleared on logout, only on an explicit "use a different
 * ID" action, per the spec. */
export function getLastLogin(): LastLogin | null {
  try {
    const raw = localStorage.getItem(EMPLOYEE_LAST_LOGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') return parsed;
    return null;
  } catch { return null; }
}

export function setLastLogin(login: LastLogin) {
  try { localStorage.setItem(EMPLOYEE_LAST_LOGIN_KEY, JSON.stringify(login)); } catch { /* ignore */ }
}

export function clearLastLogin() {
  try { localStorage.removeItem(EMPLOYEE_LAST_LOGIN_KEY); } catch { /* ignore */ }
}

// ─── Admin (manager/ceo) auth ───────────────────────────────────────────────

export async function adminLogin(email: string, pin: string) {
  return postJson<{ token: string; id: string; name: string; role: string; email: string }>('/api/auth/admin-login', { email, pin });
}

export function getAdminToken(): string | null {
  try { return localStorage.getItem(ADMIN_TOKEN_KEY); } catch { return null; }
}

export function setAdminToken(token: string) {
  try { localStorage.setItem(ADMIN_TOKEN_KEY, token); } catch { /* ignore */ }
}

export function clearAdminToken() {
  try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* ignore */ }
}

// ─── Shared session validation / logout ─────────────────────────────────────

export async function fetchMe(token: string) {
  return getJson<{ user: SessionUser }>('/api/auth/me', token);
}

/** Revokes the session server-side. Best-effort — the caller always clears
 * the local token regardless of whether this network call succeeds. */
export async function logout(token: string): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch { /* ignore — local token is cleared by the caller either way */ }
}

// ─── Drawing event logging ──────────────────────────────────────────────────

export interface DrawingLogPayload {
  productCategory: string;
  productName: string;
  projectId?: string;
  clientName?: string;
  pdfGenerated: boolean;
  measurements?: unknown;
}

/** Fire-and-forget: logs a drawing event server-side. Never throws and
 * never blocks the caller's own (localStorage) save — a failed network
 * call here must not break the existing employee-facing save/PDF flow. */
export function logDrawingEvent(payload: DrawingLogPayload): void {
  const token = getEmployeeToken();
  if (!token) return;
  fetch('/api/drawings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }).catch(() => { /* best-effort — never surfaces to the employee */ });
}

// ─── Employee "My Stats" ────────────────────────────────────────────────────

export interface MyStats {
  employeeId: string;
  employeeName: string;
  total: number;
  byProduct: { product_name: string; count: number }[];
}

export async function fetchMyStats(from?: string, to?: string) {
  const token = getEmployeeToken();
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return getJson<MyStats>(`/api/profile/my-stats${qs ? `?${qs}` : ''}`, token);
}
