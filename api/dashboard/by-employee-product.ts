// GET /api/dashboard/by-employee-product?from=&to=  (manager/ceo only)
// The employee x product matrix — powers the leaderboard table and the
// stacked-bar chart. Returns flat rows; the frontend pivots into a matrix
// so adding a new product never requires a schema/query change here.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { requireAdmin } from '../_lib/requireAdmin.js';
import { jsonError, jsonOk, withErrorHandling } from '../_lib/respond.js';
import { parseDateRange } from '../_lib/dateRange.js';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed.');
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { from, to } = parseDateRange(req.query);
  const db = sql();

  const rows = await db`
    SELECT u.id AS employee_id, u.name AS employee_name, d.product_name, count(*)::int AS count
    FROM drawings d
    JOIN users u ON u.id = d.employee_id
    WHERE d.created_at >= ${from} AND d.created_at <= ${to}
    GROUP BY u.id, u.name, d.product_name
    ORDER BY u.name, count DESC
  `;

  jsonOk(res, { rows });
});
