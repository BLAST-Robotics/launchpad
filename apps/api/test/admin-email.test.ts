import { afterAll, describe, expect, test } from "bun:test";
import { db, pingDb, schema } from "@launchpad/db";
import { apiErrorSchema } from "@launchpad/shared";
import { and, eq, inArray } from "drizzle-orm";
import { createApp } from "../src/app";
import { grantAdminIfListed } from "../src/auth";

const app = createApp();
const dbUp = await pingDb().then(
  (v) => v === true,
  () => false,
);

const post = (path: string, body: unknown) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify(body),
    }),
  );

describe("password sign-up is blocked for admin addresses (D-023)", () => {
  test("a listed address is refused with the plain message, in any letter case", async () => {
    for (const email of ["fake-admin@example.test", "  FAKE-ADMIN@Example.Test "]) {
      const response = await post("/api/auth/sign-up/email", {
        name: "Someone",
        email,
        password: "a-long-enough-password",
      });
      expect(response.status).toBe(400);
      const body = (await response.json()) as { message?: string };
      expect(body.message).toBe("This address signs in with Google.");
    }
  });
});

describe("the welcome skip is closed without a session", () => {
  test("401 with the JSON envelope", async () => {
    const response = await post("/api/onboarding/skip", {});
    expect(response.status).toBe(401);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe("UNAUTHENTICATED");
  });
});

describe.skipIf(!dbUp)("grantAdminIfListed (database)", () => {
  const email = "fake-admin@example.test";
  let userId = "";

  afterAll(async () => {
    if (!userId) return;
    await db.delete(schema.auditLog).where(eq(schema.auditLog.entityId, userId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  test("a verified Google user on the list becomes admin once, keeping other roles", async () => {
    const [row] = await db
      .insert(schema.users)
      .values({ name: "Test Admin", email, emailVerified: true, roles: ["parent"] })
      .returning({ id: schema.users.id });
    userId = row?.id ?? "";
    await db.insert(schema.accounts).values({
      userId,
      accountId: `google-${userId}`,
      providerId: "google",
    });

    expect(await grantAdminIfListed(userId)).toBe(true);
    const after = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    expect([...(after?.roles ?? [])].sort()).toEqual(["admin", "parent"]);

    // Idempotent: nothing changes and no second audit row is written.
    expect(await grantAdminIfListed(userId)).toBe(false);
    const audits = await db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, userId),
          eq(schema.auditLog.action, "member.admin_granted"),
        ),
      );
    expect(audits.length).toBe(1);
  });

  test("a listed address without a Google identity is never granted", async () => {
    await db.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
    await db
      .update(schema.users)
      .set({ roles: ["pending"] })
      .where(eq(schema.users.id, userId));
    expect(await grantAdminIfListed(userId)).toBe(false);
    const after = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    expect(after?.roles).toEqual(["pending"]);
  });

  test("an unverified Google email is never granted", async () => {
    await db.insert(schema.accounts).values({
      userId,
      accountId: `google-${userId}`,
      providerId: "google",
    });
    await db.update(schema.users).set({ emailVerified: false }).where(eq(schema.users.id, userId));
    expect(await grantAdminIfListed(userId)).toBe(false);
    const ids = [userId];
    await db.delete(schema.accounts).where(inArray(schema.accounts.userId, ids));
  });
});
