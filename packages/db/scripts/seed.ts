import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "./load-env";

/**
 * Seeds the current season. Idempotent: re-running updates the same row by name.
 * Edit the values here when the season rolls over (ROADMAP Phase 5 automates it).
 */
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is not set.");
  process.exit(1);
}

const SEASON = {
  name: "2027",
  startsOn: "2026-08-01",
  endsOn: "2027-06-30",
} as const;

const client = postgres(url, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });
const db = drizzle(client);

try {
  await db.execute(sql`update "seasons" set "is_current" = false where "is_current" = true`);
  await db.execute(sql`
    insert into "seasons" ("name", "starts_on", "ends_on", "is_current")
    values (${SEASON.name}, ${SEASON.startsOn}, ${SEASON.endsOn}, true)
    on conflict ("name") do update
      set "starts_on" = excluded."starts_on",
          "ends_on" = excluded."ends_on",
          "is_current" = true,
          "updated_at" = now()
  `);
  console.log(`seeded season ${SEASON.name} as current`);
} finally {
  await client.end({ timeout: 5 });
}
