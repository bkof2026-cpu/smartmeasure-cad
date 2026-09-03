// POST /api/drawings  (Authorization: Bearer <employee session token>)
// Body: { productCategory, productName, projectId?, clientName?, pdfGenerated, measurements }
// Logs one drawing/measurement event. employee_id is ALWAYS taken from the
// caller's own validated session — never from the request body — so one
// employee can never log an event under another employee's name.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_lib/db.js';
import { getSessionUser, tokenFromRequest } from './_lib/auth.js';
import { jsonError, jsonOk, withErrorHandling } from './_lib/respond.js';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed.');

  const user = await getSessionUser(tokenFromRequest(req));
  if (!user) return jsonError(res, 401, 'Not authenticated.');

  const body = req.body ?? {};
  const productCategory = typeof body.productCategory === 'string' ? body.productCategory : '';
  const productName = typeof body.productName === 'string' ? body.productName : '';
  if (!productCategory || !productName) {
    return jsonError(res, 400, 'productCategory and productName are required.');
  }
  const projectId = typeof body.projectId === 'string' ? body.projectId : null;
  const clientName = typeof body.clientName === 'string' ? body.clientName : null;
  const pdfGenerated = Boolean(body.pdfGenerated);
  // Stored as-is in JSONB — this is measurement data the employee entered
  // themselves for their own drawing, not sensitive beyond what's already
  // visible to them; no further validation needed for a reporting log.
  const measurements = body.measurements ?? null;

  const db = sql();
  await db`
    INSERT INTO drawings (employee_id, product_category, product_name, project_id, client_name, pdf_generated, measurements_json)
    VALUES (${user.id}, ${productCategory}, ${productName}, ${projectId}, ${clientName}, ${pdfGenerated}, ${JSON.stringify(measurements)})
  `;

  jsonOk(res, { ok: true });
});
