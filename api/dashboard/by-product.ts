// GET /api/dashboard/by-product?from=&to=  (manager/ceo only)
// Total drawings per product across all employees — company-wide bar chart.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAdmin } from '../_lib/requireAdmin';
import { jsonError, jsonOk, withErrorHandling } from '../_lib/respond';
import { parseDateRange } from '../_lib/dateRange';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed.');
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { from, to } = parseDateRange(req.query);
  const db = sql();

  const rows = await db`
    SELECT product_name, count(*)::int AS count
    FROM drawings
    WHERE created_at >= ${from} AND created_at <= ${to}
    GROUP BY product_name
    ORDER BY count DESC
  `;

  jsonOk(res, { rows });
});
