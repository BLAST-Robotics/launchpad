import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import "./load-env";

/**
 * Applies committed migrations with the **unpooled** Neon connection.
 * Running this twice is a no-op: drizzle records applied migrations in
 * `drizzle.__drizzle_migrations`.
 */
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is not set; refusing to migrate through the pooler.");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });

try {
  await migrate(drizzle(client), { migrationsFolder: "./migrations" });
  console.log("migrations applied");
} finally {
  await client.end({ timeout: 5 });
}
