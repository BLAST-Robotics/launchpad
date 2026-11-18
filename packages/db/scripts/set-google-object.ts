import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "./load-env";

/**
 * Registers (or updates) one Google object in `google_objects`, so no Drive, group or calendar
 * ID ever lives in source (D-019).
 *
 *   bun run db:set-google-object -- <kind> <key> <externalId> [email] [label]
 *
 * kind: group | shared_drive | folder | calendar. Upserts on (kind, key), so it is safe to
 * re-run. Examples:
 *   ... -- folder core-values <driveFolderId>        (where core-values videos go)
 *   ... -- shared_drive drives.team <sharedDriveId>  (fallback parent for videos)
 * Prints a success or failure line only; IDs and addresses are never echoed.
 */
const KINDS = ["group", "shared_drive", "folder", "calendar"] as const;
type Kind = (typeof KINDS)[number];

const args = process.argv.slice(2).filter((a) => a !== "--");
const [kind, key, externalId, email, label] = args;

if (!kind || !KINDS.includes(kind as Kind) || !key || !externalId) {
  console.error(
    "Usage: bun run db:set-google-object -- <group|shared_drive|folder|calendar> <key> <externalId> [email] [label]",
  );
  process.exit(1);
}
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is not set.");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });
const db = drizzle(client);

try {
  await db.execute(sql`
    insert into "google_objects" ("kind", "key", "external_id", "email", "label")
    values (${kind}::google_object_kind, ${key}, ${externalId}, ${email || null}, ${label || null})
    on conflict ("kind", "key") do update
      set "external_id" = excluded."external_id",
          "email" = excluded."email",
          "label" = excluded."label",
          "updated_at" = now()
  `);
  console.log(`registered ${kind} "${key}"`);
} finally {
  await client.end({ timeout: 5 });
}
