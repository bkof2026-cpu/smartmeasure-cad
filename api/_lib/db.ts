// ─────────────────────────────────────────────────────────────────────────────
// Shared Neon Postgres client for every /api/* serverless function.
// Uses @neondatabase/serverless's tagged-template `sql` — every value is a
// real parameterized bind, never string-concatenated, so this is SQL-
// injection-safe by construction as long as callers always use the tag
// (never build a raw string and pass it through `sql.query(...)`).
// ─────────────────────────────────────────────────────────────────────────────
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Explicit <false, false> generics — arrayMode:false, fullResults:false —
// pin every query's result type to plain Record<string, any>[] (row
// objects, not FullQueryResults/array-mode tuples). Without this, `neon`'s
// own generic defaults get erased through ReturnType<typeof neon> and every
// caller's `rows[0]` becomes an untyped union TypeScript can't index.
let cached: NeonQueryFunction<false, false> | null = null;

/** Lazily creates the Neon client on first use — DATABASE_URL is read here,
 * not at module-load time, so a missing env var fails the specific request
 * that needed it (with a clear message) instead of crashing the whole
 * serverless bundle at cold-start. */
export function sql(): NeonQueryFunction<false, false> {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — add it in Vercel project settings (or .env.local for local dev).');
  }
  cached = neon(url);
  return cached;
}
