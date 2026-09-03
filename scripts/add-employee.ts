// npm run add-employee -- --id=E101 --name="John Doe"
// npm run add-employee -- --id=M001 --name="Jane Manager" --role=manager --email=jane@example.com --pin=482913
//
// Owner-run CLI to insert a user row directly — no in-app admin screen, per
// the spec. `--role` defaults to 'employee' (no email/PIN needed). For
// manager/ceo, --email and --pin are both required; the PIN is bcrypt-
// hashed before it ever touches the database or gets logged anywhere.
import bcrypt from 'bcryptjs';
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
  const name = args.name?.trim();
  const role = (args.role?.trim() || 'employee') as 'employee' | 'manager' | 'ceo';

  if (!id || !name) {
    console.error('Usage: npm run add-employee -- --id=E101 --name="John Doe" [--role=employee|manager|ceo] [--email=...] [--pin=...]');
    process.exit(1);
  }
  if (!['employee', 'manager', 'ceo'].includes(role)) {
    console.error(`Invalid --role "${role}" — must be employee, manager, or ceo.`);
    process.exit(1);
  }

  let email: string | null = null;
  let pinHash: string | null = null;
  if (role === 'manager' || role === 'ceo') {
    email = args.email?.trim().toLowerCase() || null;
    const pin = args.pin?.trim() || null;
    if (!email || !pin) {
      console.error(`--role=${role} requires both --email and --pin.`);
      process.exit(1);
    }
    if (pin.length < 4) {
      console.error('--pin should be at least 4 characters.');
      process.exit(1);
    }
    pinHash = await bcrypt.hash(pin, 12);
  }

  const sql = neon(url);
  await sql`
    INSERT INTO users (id, name, role, email, pin_hash, is_active)
    VALUES (${id}, ${name}, ${role}, ${email}, ${pinHash}, true)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      email = EXCLUDED.email,
      pin_hash = COALESCE(EXCLUDED.pin_hash, users.pin_hash),
      is_active = true
  `;

  console.log(`✓ ${role} "${name}" (${id}) added${email ? ` — email: ${email}` : ''}.`);
}

main().catch((err) => {
  console.error('Failed to add user:', err.message || err);
  process.exit(1);
});
