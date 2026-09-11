// GET /api/dashboard/by-product?from=&to=  (manager/ceo only)
// Total drawings per product across all employees — company-wide bar chart.
//
// Scoped to real field employees only (id LIKE 'BK-E%') — see summary.ts.
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
    SELECT d.product_name, count(*)::int AS count
    FROM drawings d
    JOIN users u ON u.id = d.employee_id
    WHERE d.created_at >= ${from} AND d.created_at <= ${to} AND u.id LIKE 'BK-E%'
    GROUP BY d.product_name
    ORDER BY count DESC
  `;

  jsonOk(res, { rows });
});
