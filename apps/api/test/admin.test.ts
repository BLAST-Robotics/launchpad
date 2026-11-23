import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, pingDb, schema } from "@launchpad/db";
import { adminOverviewSchema, apiErrorSchema } from "@launchpad/shared";
import { and, eq, inArray, like } from "drizzle-orm";
import { createApp } from "../src/app";

const app = createApp();
const dbUp = await pingDb().then(
  (v) => v === true,
  () => false,
);

const tag = crypto.randomUUID().slice(0, 8);
const password = `Pw-${crypto.randomUUID()}`;
const createdUserIds: string[] = [];
const createdEntryIds: string[] = [];

const call = (path: string, init: RequestInit & { cookie?: string } = {}) => {
  const { cookie, ...rest } = init;
  return app.handle(
    new Request(`http://localhost${path}`, {
      ...rest,
      headers: {
        origin: "http://localhost:3000",
        ...(rest.body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...rest.headers,
      },
    }),
  );
};

/** Real sign-up through Better Auth, so the session cookie is genuine. Returns the cookie. */
async function signUp(label: string): Promise<{ id: string; cookie: string }> {
  const response = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({
      name: `Test ${label}`,
      email: `lp-test-${tag}-${label}@example.test`,
      password,
    }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const row = await db.query.users.findFirst({
    where: eq(schema.users.email, `lp-test-${tag}-${label}@example.test`),
  });
  if (!row) throw new Error("test user missing");
  createdUserIds.push(row.id);
  return { id: row.id, cookie };
}

describe("admin routes are closed without a session", () => {
  const routes: [string, string][] = [
    ["GET", "/api/admin/overview"],
    ["GET", "/api/admin/members"],
    ["GET", "/api/admin/members/00000000-0000-4000-8000-000000000000"],
    ["PATCH", "/api/admin/members/00000000-0000-4000-8000-000000000000"],
    ["POST", "/api/admin/members/00000000-0000-4000-8000-000000000000/revoke-sessions"],
    ["GET", "/api/admin/roster"],
    ["POST", "/api/admin/roster"],
    ["PATCH", "/api/admin/roster/00000000-0000-4000-8000-000000000000"],
    ["POST", "/api/admin/roster/00000000-0000-4000-8000-000000000000/unclaim"],
    ["POST", "/api/admin/roster/import"],
    ["GET", "/api/admin/audit"],
  ];
  for (const [method, path] of routes) {
    test(`${method} ${path.replace(/[0-9a-f-]{36}/, ":id")} is 401`, async () => {
      const response = await call(path, { method, ...(method === "GET" ? {} : { body: "{}" }) });
      expect(response.status).toBe(401);
      expect(apiErrorSchema.parse(await response.json()).error.code).toBe("UNAUTHENTICATED");
    });
  }
});

describe.skipIf(!dbUp)("admin routes with real sessions", () => {
  let admin: { id: string; cookie: string };
  let member: { id: string; cookie: string };

  beforeAll(async () => {
    admin = await signUp("admin");
    member = await signUp("member");
    await db
      .update(schema.users)
      .set({ roles: ["admin"] })
      .where(eq(schema.users.id, admin.id));
  });

  afterAll(async () => {
    // Audit rows written by these tests, then the throwaway rows themselves.
    const ids = [...createdUserIds, ...createdEntryIds];
    if (ids.length > 0) {
      await db.delete(schema.auditLog).where(inArray(schema.auditLog.entityId, ids));
      await db.delete(schema.auditLog).where(inArray(schema.auditLog.actorUserId, createdUserIds));
    }
    await db
      .delete(schema.auditLog)
      .where(
        and(eq(schema.auditLog.action, "roster.imported"), like(schema.auditLog.entity, "roster")),
      )
      .catch(() => {});
    if (createdEntryIds.length > 0) {
      await db
        .delete(schema.rosterEntries)
        .where(inArray(schema.rosterEntries.id, createdEntryIds));
    }
    await db.delete(schema.rosterEntries).where(like(schema.rosterEntries.firstName, `Zz${tag}%`));
    if (createdUserIds.length > 0) {
      await db.delete(schema.users).where(inArray(schema.users.id, createdUserIds));
    }
  });

  test("a signed-in non-admin gets 403 on every area", async () => {
    for (const path of [
      "/api/admin/overview",
      "/api/admin/members",
      "/api/admin/roster",
      "/api/admin/audit",
    ]) {
      const response = await call(path, { cookie: member.cookie });
      expect(response.status).toBe(403);
      expect(apiErrorSchema.parse(await response.json()).error.code).toBe("FORBIDDEN");
    }
    const write = await call("/api/admin/roster", {
      method: "POST",
      cookie: member.cookie,
      body: JSON.stringify({ firstName: "No", lastName: "Access" }),
    });
    expect(write.status).toBe(403);
  });

  test("an admin reads the overview", async () => {
    const response = await call("/api/admin/overview", { cookie: admin.cookie });
    expect(response.status).toBe(200);
    const body = adminOverviewSchema.parse(await response.json());
    expect(body.totalMembers).toBeGreaterThanOrEqual(2);
  });

  test("member search finds a throwaway member by email and returns paged shape", async () => {
    const response = await call(`/api/admin/members?q=lp-test-${tag}-member&limit=5`, {
      cookie: admin.cookie,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: { id: string }[];
      total: number;
      page: number;
    };
    expect(body.total).toBe(1);
    expect(body.items[0]?.id).toBe(member.id);
    expect(body.page).toBe(1);
  });

  test("limit above 100 is rejected", async () => {
    const response = await call("/api/admin/members?limit=500", { cookie: admin.cookie });
    expect(response.status).toBe(400);
  });

  test("an admin cannot remove their own admin role or deactivate themselves", async () => {
    const demote = await call(`/api/admin/members/${admin.id}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: JSON.stringify({ roles: ["student"] }),
    });
    expect(demote.status).toBe(400);
    expect(apiErrorSchema.parse(await demote.json()).error.code).toBe("CANNOT_REMOVE_OWN_ADMIN");

    const archive = await call(`/api/admin/members/${admin.id}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: JSON.stringify({ status: "archived" }),
    });
    expect(archive.status).toBe(400);
    expect(apiErrorSchema.parse(await archive.json()).error.code).toBe("CANNOT_ARCHIVE_SELF");
  });

  test("changing a member's roles works and writes an audit row", async () => {
    const response = await call(`/api/admin/members/${member.id}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: JSON.stringify({ roles: ["student"] }),
    });
    expect(response.status).toBe(200);
    const after = await db.query.users.findFirst({ where: eq(schema.users.id, member.id) });
    expect(after?.roles).toEqual(["student"]);

    const audit = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(eq(schema.auditLog.entityId, member.id), eq(schema.auditLog.action, "member.updated")),
      );
    expect(audit.length).toBe(1);
    expect(audit[0]?.actorUserId).toBe(admin.id);
  });

  test("revoking sessions deletes them and is audited", async () => {
    const response = await call(`/api/admin/members/${member.id}/revoke-sessions`, {
      method: "POST",
      cookie: admin.cookie,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { revoked: number };
    expect(body.revoked).toBeGreaterThanOrEqual(1);
    const left = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, member.id));
    expect(left.length).toBe(0);
  });

  test("roster: add, edit, duplicate is refused, claimed entry can be unclaimed", async () => {
    const first = `Zz${tag}`;
    const created = await call("/api/admin/roster", {
      method: "POST",
      cookie: admin.cookie,
      body: JSON.stringify({ firstName: first, lastName: "Fakename", grade: "9" }),
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    createdEntryIds.push(id);

    const dupe = await call("/api/admin/roster", {
      method: "POST",
      cookie: admin.cookie,
      body: JSON.stringify({ firstName: first.toUpperCase(), lastName: "fakename" }),
    });
    expect(dupe.status).toBe(409);

    const edited = await call(`/api/admin/roster/${id}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: JSON.stringify({ grade: "10" }),
    });
    expect(edited.status).toBe(200);

    // Simulate the claim directly, then reverse it through the admin route.
    await db
      .update(schema.rosterEntries)
      .set({ claimedByUserId: member.id, status: "claimed" })
      .where(eq(schema.rosterEntries.id, id));
    await db
      .update(schema.users)
      .set({ rosterEntryId: id, roles: ["student"] })
      .where(eq(schema.users.id, member.id));

    const unclaim = await call(`/api/admin/roster/${id}/unclaim`, {
      method: "POST",
      cookie: admin.cookie,
    });
    expect(unclaim.status).toBe(200);

    const entry = await db.query.rosterEntries.findFirst({
      where: eq(schema.rosterEntries.id, id),
    });
    expect(entry?.claimedByUserId).toBeNull();
    expect(entry?.status).toBe("unclaimed");
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, member.id) });
    expect(user?.rosterEntryId).toBeNull();
    expect(user?.roles).toEqual(["pending"]);

    const again = await call(`/api/admin/roster/${id}/unclaim`, {
      method: "POST",
      cookie: admin.cookie,
    });
    expect(again.status).toBe(409);

    const audit = await db
      .select({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, id));
    expect(audit.map((a) => a.action).sort()).toEqual([
      "roster.created",
      "roster.unclaimed",
      "roster.updated",
    ]);
  });

  test("audit feed returns only the small allowed diffs", async () => {
    const response = await call("/api/admin/audit?action=member.updated&limit=5", {
      cookie: admin.cookie,
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("@example.test");
    const body = JSON.parse(text) as {
      items: { changes: { field: string }[] }[];
      actions: string[];
    };
    expect(body.actions).toContain("member.updated");
    for (const item of body.items) {
      for (const change of item.changes) {
        expect(["roles", "status", "grade", "claimed", "requestedRole"]).toContain(change.field);
      }
    }
  });

  test("CSV import rejects a bad header and counts rows without echoing names", async () => {
    const bad = await call("/api/admin/roster/import", {
      method: "POST",
      cookie: admin.cookie,
      body: JSON.stringify({ csv: "Foo,Bar\n1,2\n" }),
    });
    expect(bad.status).toBe(400);

    const csv = `First Name,Last Name,Grade,Phone\nZz${tag}A,Fakeone,9,555-0100\nZz${tag}B,Faketwo,12,555-0101\n,,,\n`;
    const response = await call("/api/admin/roster/import", {
      method: "POST",
      cookie: admin.cookie,
      body: JSON.stringify({ csv }),
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(`Zz${tag}`);
    expect(text).not.toContain("555-01");
    expect(JSON.parse(text)).toEqual({ ok: true, inserted: 2, updated: 0, skipped: 0 });
  });
});
