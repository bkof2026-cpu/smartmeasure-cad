// GET /api/dashboard/summary?from=&to=  (manager/ceo only)
// KPI cards: total drawings, active employees, most active employee, most-
// measured product — all scoped to the requested date range.
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

  const totalRows = await db`
    SELECT count(*)::int AS total FROM drawings WHERE created_at >= ${from} AND created_at <= ${to}
  `;
  const activeEmployeesRows = await db`
    SELECT count(*)::int AS n FROM users WHERE role = 'employee' AND is_active = true
  `;
  const topEmployeeRows = await db`
    SELECT u.id, u.name, count(*)::int AS count
    FROM drawings d JOIN users u ON u.id = d.employee_id
    WHERE d.created_at >= ${from} AND d.created_at <= ${to}
    GROUP BY u.id, u.name
    ORDER BY count DESC
    LIMIT 1
  `;
  const topProductRows = await db`
    SELECT product_name, count(*)::int AS count
    FROM drawings
    WHERE created_at >= ${from} AND created_at <= ${to}
    GROUP BY product_name
    ORDER BY count DESC
    LIMIT 1
  `;

  jsonOk(res, {
    totalDrawings: (totalRows[0] as { total: number }).total,
    activeEmployees: (activeEmployeesRows[0] as { n: number }).n,
    mostActiveEmployee: (topEmployeeRows[0] as { id: string; name: string; count: number } | undefined) ?? null,
    mostMeasuredProduct: (topProductRows[0] as { product_name: string; count: number } | undefined) ?? null,
  });
});
