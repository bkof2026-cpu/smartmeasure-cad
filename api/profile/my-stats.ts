// GET /api/profile/my-stats?from=&to=  (Authorization: Bearer <employee session token>)
// Returns the CALLING employee's own drawing counts by product — the
// employee_id used in the query comes ONLY from their own validated
// session, never from a query param, so one employee can never view
// another's stats by guessing an ID. Any role (employee/manager/ceo) can
// call this for their OWN id; managers/ceo use the separate /api/dashboard/*
// routes to see everyone.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { getSessionUser, tokenFromRequest } from '../_lib/auth.js';
import { jsonError, jsonOk, withErrorHandling } from '../_lib/respond.js';
import { parseDateRange } from '../_lib/dateRange.js';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed.');

  const user = await getSessionUser(tokenFromRequest(req));
  if (!user) return jsonError(res, 401, 'Not authenticated.');

  const { from, to } = parseDateRange(req.query);

  const db = sql();
  const rows = await db`
    SELECT product_name, count(*)::int AS count
    FROM drawings
    WHERE employee_id = ${user.id}
      AND created_at >= ${from}
      AND created_at <= ${to}
    GROUP BY product_name
    ORDER BY count DESC
  `;
  const totalRows = await db`
    SELECT count(*)::int AS total
    FROM drawings
    WHERE employee_id = ${user.id}
      AND created_at >= ${from}
      AND created_at <= ${to}
  `;

  jsonOk(res, {
    employeeId: user.id,
    employeeName: user.name,
    total: (totalRows[0] as { total: number }).total,
    byProduct: rows as { product_name: string; count: number }[],
  });
});
