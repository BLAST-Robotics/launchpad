import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "./load-env";

/**
 * Bootstraps an admin. There is deliberately no in-app way to become one.
 *
 *   bun run db:make-admin -- <email>
 *
 * The person must already have an account (they sign in once first). Adds the `admin` role,
 * keeping any other roles, and writes an `audit_log` row attributed to the system.
 * Prints a success or failure line only; the email is never echoed or logged.
 */
const email = process.argv
  .slice(2)
  .find((a) => a !== "--")
  ?.trim();
if (!email?.includes("@")) {
  console.error("Usage: bun run db:make-admin -- <email>");
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
  const result = await db.transaction(async (tx) => {
    const [user] = await tx.execute<{ id: string; roles: string[] }>(
      sql`select id, roles from "user" where lower(email) = lower(${email}) limit 1 for update`,
    );
    if (!user) return "missing" as const;
    if (user.roles.includes("admin")) return "already" as const;

    await tx.execute(sql`
      update "user"
      set roles = array_append(array_remove(roles, 'pending'::"role"), 'admin'::"role"),
          updated_at = now()
      where id = ${user.id}`);
    await tx.execute(sql`
      insert into "audit_log" (actor_user_id, action, entity, entity_id, before, after)
      values (null, 'member.admin_granted', 'user', ${user.id},
              ${JSON.stringify({ roles: user.roles })}::jsonb,
              ${JSON.stringify({ roles: [...user.roles.filter((r) => r !== "pending"), "admin"] })}::jsonb)`);
    return "granted" as const;
  });

  if (result === "missing") {
    console.error("make-admin: no account with that email. They must sign in once first.");
    process.exitCode = 1;
  } else if (result === "already") {
    console.log("make-admin: that account is already an admin (no change).");
  } else {
    console.log("make-admin: admin role granted.");
  }
} finally {
  await client.end({ timeout: 5 });
}
