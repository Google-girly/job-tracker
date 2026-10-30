// Applies supabase/migrations/*.sql in order, once each. Usage: npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
const dir = path.join(process.cwd(), "supabase", "migrations");

try {
  await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`;
  // Keep the bookkeeping table off Supabase's public REST API too.
  await sql`alter table _migrations enable row level security`;
  const applied = new Set((await sql`select name from _migrations`).map((r) => r.name));

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
      await tx`insert into _migrations (name) values (${file})`;
    });
    console.log(`  apply ${file}`);
  }
  console.log("Database is up to date.");
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
