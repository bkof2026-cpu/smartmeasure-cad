// POST /api/auth/employee-login  { id: string }
// Looks up an active employee by ID, issues a 90-day session token.
// No password — the spec's model is "owner-provisioned Employee ID is the
// credential," matching how these IDs are handed out in person/on a device
// already trusted by the business, not typed by an anonymous visitor.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { createSession, isRateLimited, recordLoginAttempt, clientIp } from '../_lib/auth';
import { jsonError, jsonOk, withErrorHandling } from '../_lib/respond';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed.');

  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
  if (!id) return jsonError(res, 400, 'Employee ID is required.');

  const ip = clientIp(req);
  if (await isRateLimited(id, ip)) {
    return jsonError(res, 429, 'Too many login attempts. Try again in a few minutes.');
  }
  await recordLoginAttempt(id, ip);

  const db = sql();
  const rows = await db`
    SELECT id, name FROM users
    WHERE id = ${id} AND role = 'employee' AND is_active = true
    LIMIT 1
  `;
  if (rows.length === 0) return jsonError(res, 401, 'Employee ID not found.');

  const user = rows[0] as { id: string; name: string };
  const token = await createSession(user.id);
  jsonOk(res, { token, id: user.id, name: user.name });
});
