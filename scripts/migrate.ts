// Runs db/schema.sql against DATABASE_URL — `npm run migrate`.
// Safe to re-run: every statement in schema.sql is idempotent (IF NOT
// EXISTS / EXCEPTION-guarded), so running this twice is a no-op, not an
// error, matching the AGENTS.md-adjacent "never break existing state" rule
// applied to database migrations.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from './lib/loadEnv';

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Add it to .env.local (DATABASE_URL=postgres://...) or export it in your shell.');
    process.exit(1);
  }
  const sql = neon(url);
  const schemaPath = resolve(process.cwd(), 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  // neon() over HTTP executes one statement per call — split on statement-
  // terminating semicolons that are not inside a dollar-quoted DO block.
  const statements = splitSqlStatements(schema);

  console.log(`Running ${statements.length} statement(s) from db/schema.sql ...`);
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    await sql.query(trimmed);
  }
  console.log('✓ Migration complete.');
}

/** Splits a SQL file into individual statements, treating `$$ ... $$`
 * dollar-quoted blocks (used by the DO $$ ... END $$ guard for CREATE TYPE)
 * as atomic so a semicolon inside one doesn't split it apart. */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  for (let i = 0; i < sql.length; i++) {
    const chunk = sql.slice(i, i + 2);
    if (chunk === '$$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i++;
      continue;
    }
    const ch = sql[i];
    current += ch;
    if (ch === ';' && !inDollarQuote) {
      statements.push(current);
      current = '';
    }
  }
  if (current.trim()) statements.push(current);
  return statements;
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
