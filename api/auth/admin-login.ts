// POST /api/auth/admin-login  { email: string, pin: string }
// Manager/CEO login — email + PIN checked against a bcrypt hash. Always
// returns the same generic "Invalid credentials" whether the email doesn't
// exist or the PIN is wrong, so a caller can't enumerate valid emails.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { sql } from '../_lib/db';
import { createSession, isRateLimited, recordLoginAttempt, clientIp } from '../_lib/auth';
import { jsonError, jsonOk, withErrorHandling } from '../_lib/respond';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed.');

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
  if (!email || !pin) return jsonError(res, 400, 'Email and PIN are required.');

  const ip = clientIp(req);
  if (await isRateLimited(email, ip)) {
    return jsonError(res, 429, 'Too many login attempts. Try again in a few minutes.');
  }
  await recordLoginAttempt(email, ip);

  const db = sql();
  const rows = await db`
    SELECT id, name, role, email, pin_hash FROM users
    WHERE email = ${email} AND role IN ('manager', 'ceo') AND is_active = true
    LIMIT 1
  `;

  const GENERIC_ERROR = 'Invalid credentials.';
  if (rows.length === 0) return jsonError(res, 401, GENERIC_ERROR);

  const user = rows[0] as { id: string; name: string; role: string; email: string; pin_hash: string | null };
  if (!user.pin_hash) return jsonError(res, 401, GENERIC_ERROR);

  const valid = await bcrypt.compare(pin, user.pin_hash);
  if (!valid) return jsonError(res, 401, GENERIC_ERROR);

  const token = await createSession(user.id);
  jsonOk(res, { token, id: user.id, name: user.name, role: user.role, email: user.email });
});
