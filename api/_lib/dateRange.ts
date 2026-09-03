/** Parses `?from=&to=` query params (ISO date strings) shared by every
 * reporting endpoint. Defaults to the last 30 days when unset, matching
 * the dashboard spec's default filter — callers that want "All Time" pass
 * an explicit far-past `from` instead of omitting it. */
export function parseDateRange(query: Record<string, string | string[] | undefined>): { from: string; to: string } {
  const rawFrom = Array.isArray(query.from) ? query.from[0] : query.from;
  const rawTo = Array.isArray(query.to) ? query.to[0] : query.to;

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const from = isValidDateString(rawFrom) ? rawFrom! : defaultFrom.toISOString();
  const to = isValidDateString(rawTo) ? rawTo! : now.toISOString();
  return { from, to };
}

function isValidDateString(v: string | undefined): boolean {
  if (!v) return false;
  const t = Date.parse(v);
  return !Number.isNaN(t);
}
