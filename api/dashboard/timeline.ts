// GET /api/dashboard/timeline?from=&to=&granularity=day|week  (manager/ceo only)
// Drawings generated over time — trend line/area chart.
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
  const rawGranularity = Array.isArray(req.query.granularity) ? req.query.granularity[0] : req.query.granularity;
  const granularity = rawGranularity === 'week' ? 'week' : 'day';

  const db = sql();
  // date_trunc's first argument can't be parameterized as a bind value in
  // every driver reliably, but it's constrained to exactly 'day' | 'week'
  // above (never raw user input), so this stays injection-safe.
  const rows = granularity === 'week'
    ? await db`
        SELECT date_trunc('week', d.created_at) AS bucket, count(*)::int AS count
        FROM drawings d
        JOIN users u ON u.id = d.employee_id
        WHERE d.created_at >= ${from} AND d.created_at <= ${to} AND u.id LIKE 'BK-E%'
        GROUP BY bucket
        ORDER BY bucket
      `
    : await db`
        SELECT date_trunc('day', d.created_at) AS bucket, count(*)::int AS count
        FROM drawings d
        JOIN users u ON u.id = d.employee_id
        WHERE d.created_at >= ${from} AND d.created_at <= ${to} AND u.id LIKE 'BK-E%'
        GROUP BY bucket
        ORDER BY bucket
      `;

  jsonOk(res, { granularity, rows });
});
