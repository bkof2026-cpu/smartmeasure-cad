// GET /api/auth/me  (Authorization: Bearer <token>)
// Validates a session token server-side — used on every app load to decide
// whether to skip the login screen. Also the standard way any route in this
// API resolves "who is calling" without trusting a client-supplied id/role.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionUser, tokenFromRequest } from '../_lib/auth.js';
import { jsonError, jsonOk, withErrorHandling } from '../_lib/respond.js';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed.');

  const token = tokenFromRequest(req);
  const user = await getSessionUser(token);
  if (!user) return jsonError(res, 401, 'Session is missing, expired, or the account was deactivated.');

  jsonOk(res, { user });
});
