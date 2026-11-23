import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

type Sql = ReturnType<typeof postgres>;

interface DbGlobal {
  __launchpadSql?: Sql;
  __launchpadDb?: ReturnType<typeof createDrizzle>;
}

// A module-level singleton is not enough: Bun hot reload and Vercel's function reuse
// both keep module state in ways that leak connection pools. Anchor it on globalThis.
const globalForDb = globalThis as unknown as DbGlobal;

function createSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  return postgres(url, {
    // Neon's pooled endpoint fronts PgBouncer: named prepared statements collide
    // across connections. Never enable them here.
    prepare: false,
    // One connection per function instance is enough; the pooler does the multiplexing.
    max: process.env.VERCEL ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
    onnotice: () => {},
  });
}

function createDrizzle(sqlClient: Sql) {
  return drizzle(sqlClient, { schema });
}

function getDb() {
  if (!globalForDb.__launchpadDb) {
    const sqlClient = globalForDb.__launchpadSql ?? createSql();
    globalForDb.__launchpadSql = sqlClient;
    globalForDb.__launchpadDb = createDrizzle(sqlClient);
  }
  return globalForDb.__launchpadDb;
}

/** Lazily-created Drizzle client. Throws only when first used without DATABASE_URL. */
export const db = new Proxy({} as ReturnType<typeof createDrizzle>, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});

/** Health check: one round trip with a hard timeout, so a hung pool fails fast. */
export async function pingDb(timeoutMs = 2_000): Promise<boolean> {
  const sqlClient = globalForDb.__launchpadSql ?? createSql();
  globalForDb.__launchpadSql = sqlClient;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      sqlClient`select 1`,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("database ping timed out")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function closeDb(): Promise<void> {
  const sqlClient = globalForDb.__launchpadSql;
  if (!sqlClient) return;
  await sqlClient.end({ timeout: 5 });
  globalForDb.__launchpadSql = undefined;
  globalForDb.__launchpadDb = undefined;
}

export { schema };
