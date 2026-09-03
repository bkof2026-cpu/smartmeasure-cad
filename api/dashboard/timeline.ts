// GET /api/dashboard/timeline?from=&to=&granularity=day|week  (manager/ceo only)
// Drawings generated over time — trend line/area chart.
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
  const rawGranularity = Array.isArray(req.query.granularity) ? req.query.granularity[0] : req.query.granularity;
  const granularity = rawGranularity === 'week' ? 'week' : 'day';

  const db = sql();
  // date_trunc's first argument can't be parameterized as a bind value in
  // every driver reliably, but it's constrained to exactly 'day' | 'week'
  // above (never raw user input), so this stays injection-safe.
  const rows = granularity === 'week'
    ? await db`
        SELECT date_trunc('week', created_at) AS bucket, count(*)::int AS count
        FROM drawings
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY bucket
        ORDER BY bucket
      `
    : await db`
        SELECT date_trunc('day', created_at) AS bucket, count(*)::int AS count
        FROM drawings
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY bucket
        ORDER BY bucket
      `;

  jsonOk(res, { granularity, rows });
});
