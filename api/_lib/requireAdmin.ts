import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionUser, tokenFromRequest, type SessionUser } from './auth.js';
import { jsonError } from './respond.js';

/** Validates the caller's session AND that their role is manager/ceo.
 * Returns the user on success, or null after already writing a 401/403
 * response — every dashboard route calls this first and returns
 * immediately when it gets null, so an employee-role session (or no
 * session at all) can never reach the query below it. */
export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<SessionUser | null> {
  const user = await getSessionUser(tokenFromRequest(req));
  if (!user) {
    jsonError(res, 401, 'Not authenticated.');
    return null;
  }
  if (user.role !== 'manager' && user.role !== 'ceo') {
    jsonError(res, 403, 'Manager or CEO access required.');
    return null;
  }
  return user;
}
