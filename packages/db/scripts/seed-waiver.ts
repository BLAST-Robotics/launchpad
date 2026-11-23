import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "./load-env";

/**
 * Seeds the current season's team waiver definition. Idempotent on (season, title, version).
 * Students are the audience: the one KeySign document carries a Student and a
 * Parent/Guardian field (D-009), so a guardian's signature counts for the child.
 * `keysign_document_id` and `pdf_drive_id` are filled in when the document exists in KeySign.
 */
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is not set.");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });
const db = drizzle(client);

try {
  const [season] = await db.execute<{ id: string }>(
    sql`select id from "seasons" where "is_current" = true limit 1`,
  );
  if (!season) throw new Error("No current season. Run db:seed first.");
  await db.execute(sql`
    insert into "waiver_documents" ("season_id", "title", "version", "audience_roles", "is_required")
    values (${season.id}, 'Team waiver 2027', 1, ARRAY['student']::"role"[], true)
    on conflict ("season_id", "title", "version") do nothing`);
  const [{ n } = { n: 0 }] = await db.execute<{ n: number }>(
    sql`select count(*)::int n from "waiver_documents" where season_id = ${season.id}`,
  );
  console.log(`waiver documents in current season: ${n}`);
} finally {
  await client.end({ timeout: 5 });
}
