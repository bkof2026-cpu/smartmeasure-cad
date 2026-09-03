// POST /api/auth/logout  (Authorization: Bearer <token>)
// Deletes the session row server-side so a copied/stolen token can't be
// reused after the user logs out — clearing localStorage alone would not
// actually revoke it.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteSession, tokenFromRequest } from '../_lib/auth.js';
import { jsonOk, withErrorHandling } from '../_lib/respond.js';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const token = tokenFromRequest(req);
  if (token) await deleteSession(token);
  // Always 200 — logging out an already-invalid/missing token is not an
  // error from the client's point of view, the end state is identical.
  jsonOk(res, { ok: true });
});
