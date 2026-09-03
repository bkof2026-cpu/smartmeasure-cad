// ─────────────────────────────────────────────────────────────────────────────
// Shared session/auth helpers for every /api/* route. Session tokens are
// opaque random values looked up against the `sessions` table on every
// protected request (never a self-verifying JWT) — simplest possible model
// that still lets a session be revoked instantly (logout deletes the row).
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { sql } from './db';

export type UserRole = 'employee' | 'manager' | 'ceo';

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  email: string | null;
}

/** 32 random bytes, hex-encoded (64 chars) — never a sequential/predictable ID. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

const SESSION_DAYS = 90;

/** Creates a session row for `userId` and returns the new token. Computes
 * the expiry in JS (not `now() + interval '${N} days'` in SQL) — every
 * `${...}` in a tagged-template query is bound as a real parameter, so
 * interpolating a number into an `interval '...'` string literal would
 * try to bind it INSIDE the quotes and break, not just be a style choice. */
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const db = sql();
  await db`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt})
  `;
  return token;
}

/** Looks up a session token, returning the still-active user it belongs to,
 * or null if the token is missing, expired, or the user was deactivated.
 * This is the ONLY source of truth for "who is making this request" — a
 * role or user id claimed anywhere else in the request body/query must
 * never be trusted. */
export async function getSessionUser(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const db = sql();
  const rows = await db`
    SELECT u.id, u.name, u.role, u.email
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token}
      AND s.expires_at > now()
      AND u.is_active = true
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as { id: string; name: string; role: UserRole; email: string | null };
  return { id: row.id, name: row.name, role: row.role, email: row.email };
}

/** Reads the bearer token from the Authorization header (the convention
 * every route in this API uses — the frontend sends `Authorization: Bearer
 * <token>` from whichever localStorage key applies, employee or admin). */
export function tokenFromRequest(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header || Array.isArray(header)) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

/** Deletes a session row (logout / explicit revoke). */
export async function deleteSession(token: string): Promise<void> {
  const db = sql();
  await db`DELETE FROM sessions WHERE token = ${token}`;
}

// ─── Rate limiting ──────────────────────────────────────────────────────────
// DB-backed sliding-window counter, per the spec's own "simple in-memory or
// DB-backed counter is fine at this scale" — DB-backed chosen because
// serverless functions don't share memory between invocations, so an
// in-memory counter would silently reset on every cold start and provide
// no real protection.

const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 15;

/** Returns true if `identifier` (employee id or admin email) has made too
 * many login attempts from `ip` in the last WINDOW_MINUTES. Call this
 * BEFORE checking credentials; call `recordLoginAttempt` after every
 * attempt (success or failure) so the window is accurate either way. */
export async function isRateLimited(identifier: string, ip: string): Promise<boolean> {
  const db = sql();
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const rows = await db`
    SELECT count(*)::int AS n
    FROM login_attempts
    WHERE identifier = ${identifier}
      AND ip = ${ip}
      AND attempted_at > ${windowStart}
  `;
  const n = (rows[0] as { n: number } | undefined)?.n ?? 0;
  return n >= MAX_ATTEMPTS;
}

export async function recordLoginAttempt(identifier: string, ip: string): Promise<void> {
  const db = sql();
  await db`INSERT INTO login_attempts (identifier, ip) VALUES (${identifier}, ${ip})`;
}

/** Best-effort real client IP from Vercel's forwarding headers — falls back
 * to a constant so rate limiting still groups by "unknown" rather than
 * throwing when running somewhere those headers aren't set (e.g. local dev). */
export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.socket?.remoteAddress || 'unknown';
}
