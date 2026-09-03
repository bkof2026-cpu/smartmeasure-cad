// npm run remove-employee -- --id=E101
// Soft-deletes a user (is_active = false) — their historical drawings stay
// in the database and keep showing up in dashboard reports, per the spec's
// explicit "don't cascade-delete" instruction. Also revokes any of their
// live sessions immediately, so a deactivated employee can't keep using an
// already-issued token.
import { neon } from '@neondatabase/serverless';
import { loadEnv } from './lib/loadEnv';

loadEnv();

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const m = /^--([a-zA-Z]+)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Add it to .env.local or export it in your shell.');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const id = args.id?.trim();
  if (!id) {
    console.error('Usage: npm run remove-employee -- --id=E101');
    process.exit(1);
  }

  const sql = neon(url);
  const rows = await sql`UPDATE users SET is_active = false WHERE id = ${id} RETURNING id, name, role`;
  if (rows.length === 0) {
    console.error(`No user found with id "${id}".`);
    process.exit(1);
  }
  await sql`DELETE FROM sessions WHERE user_id = ${id}`;

  const user = rows[0] as { id: string; name: string; role: string };
  console.log(`✓ ${user.role} "${user.name}" (${user.id}) deactivated — historical drawings are kept, live sessions revoked.`);
}

main().catch((err) => {
  console.error('Failed to remove user:', err.message || err);
  process.exit(1);
});
