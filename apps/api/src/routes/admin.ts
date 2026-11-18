import { db, schema } from "@launchpad/db";
import {
  type AdminAuditRow,
  type AdminMemberRow,
  type AdminRosterRow,
  AUDIT_DIFF_FIELDS,
  adminAuditQuerySchema,
  adminAuditResponseSchema,
  adminCoreValuePatchSchema,
  adminCoreValuesQuerySchema,
  adminCoreValuesResponseSchema,
  adminMemberDetailSchema,
  adminMemberPatchSchema,
  adminMembersQuerySchema,
  adminMembersResponseSchema,
  adminOverviewSchema,
  adminRosterCreateSchema,
  adminRosterImportResponseSchema,
  adminRosterImportSchema,
  adminRosterPatchSchema,
  adminRosterQuerySchema,
  adminRosterResponseSchema,
  effectiveRoles,
  graduationYearFor,
  type MemberStatus,
  parseRosterCsv,
  type Role,
  RosterCsvError,
  removeRole,
  revokeSessionsResponseSchema,
  UNAUTHENTICATED,
} from "@launchpad/shared";
import { and, count, desc, eq, gte, ilike, ne, or, type SQL, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { type Executor, writeAudit } from "../audit";
import { auth } from "../auth";
import { HttpError } from "../http-error";
import { logEvent } from "../observability";

/* ---------- guard ---------- */

/**
 * One guard for the whole subtree. It runs before every handler, so a new admin route is
 * protected by default: 401 without a session, 403 without an active `admin` role.
 * The actor id is parked per request so handlers never re-read the session.
 */
const actors = new WeakMap<Request, string>();

const envelope = (code: string, message: string) => ({ error: { code, message } });

function actorOf(request: Request): string {
  const id = actors.get(request);
  if (!id) throw new HttpError(401, "UNAUTHENTICATED", "Sign in required.");
  return id;
}

const uuid = z.string().uuid();

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      400,
      "VALIDATION",
      result.error.issues[0]?.message ?? "Check the request and try again.",
    );
  }
  return result.data;
}

async function currentSeason() {
  return (await db.query.seasons.findFirst({ where: eq(schema.seasons.isCurrent, true) })) ?? null;
}

function seasonEndYear(value: string | Date): number {
  return value instanceof Date ? value.getUTCFullYear() : Number.parseInt(value.slice(0, 4), 10);
}

/** Escape LIKE wildcards so a search for `%` is a literal search. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const iso = (value: Date | string) => new Date(value).toISOString();

/* ---------- admin counting helpers ---------- */

async function otherActiveAdmins(executor: Executor, excludeUserId: string): Promise<number> {
  const [row] = await executor
    .select({ n: count() })
    .from(schema.users)
    .where(
      and(
        ne(schema.users.id, excludeUserId),
        eq(schema.users.status, "active"),
        sql`${schema.users.roles} @> ARRAY['admin']::"role"[]`,
      ),
    );
  return row?.n ?? 0;
}

/* ---------- row builders ---------- */

const memberSelect = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
  roles: schema.users.roles,
  status: schema.users.status,
  requestedRole: schema.users.requestedRole,
  graduationYear: schema.users.graduationYear,
  profileCompletedAt: schema.users.profileCompletedAt,
  createdAt: schema.users.createdAt,
  lastLoginAt: schema.users.lastLoginAt,
  entryId: schema.rosterEntries.id,
  entryFirst: schema.rosterEntries.firstName,
  entryLast: schema.rosterEntries.lastName,
  entryGrade: schema.rosterEntries.grade,
  guardianOfCount: sql<number>`(select count(*)::int from ${schema.guardianLinks} where ${schema.guardianLinks.userId} = ${schema.users.id})`,
};

type MemberSelected = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  status: MemberStatus;
  requestedRole: string | null;
  graduationYear: number | null;
  profileCompletedAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  entryId: string | null;
  entryFirst: string | null;
  entryLast: string | null;
  entryGrade: string | null;
  guardianOfCount: number;
};

function toMemberRow(r: MemberSelected): AdminMemberRow {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    roles: r.roles,
    status: r.status,
    requestedRole: (r.requestedRole as AdminMemberRow["requestedRole"]) ?? null,
    graduationYear: r.graduationYear,
    profileComplete: r.profileCompletedAt !== null,
    createdAt: iso(r.createdAt),
    lastLoginAt: r.lastLoginAt ? iso(r.lastLoginAt) : null,
    rosterEntry:
      r.entryId && r.entryFirst !== null && r.entryLast !== null
        ? { id: r.entryId, firstName: r.entryFirst, lastName: r.entryLast, grade: r.entryGrade }
        : null,
    guardianOfCount: r.guardianOfCount,
  };
}

async function loadMember(id: string): Promise<MemberSelected | null> {
  const [row] = await db
    .select(memberSelect)
    .from(schema.users)
    .leftJoin(schema.rosterEntries, eq(schema.rosterEntries.id, schema.users.rosterEntryId))
    .where(eq(schema.users.id, id))
    .limit(1);
  return (row as MemberSelected | undefined) ?? null;
}

/** Keep only the small fields the activity log is allowed to display. */
function diffFor(before: unknown, after: unknown): AdminAuditRow["changes"] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const show = (v: unknown): string | null =>
    v === undefined || v === null ? null : Array.isArray(v) ? v.join(", ") : String(v);

  const changes: AdminAuditRow["changes"] = [];
  for (const field of AUDIT_DIFF_FIELDS) {
    if (!(field in b) && !(field in a)) continue;
    const from = show(b[field]);
    const to = show(a[field]);
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

/* ---------- routes ---------- */

export const adminRoutes = new Elysia({ name: "admin", prefix: "/api/admin" })
  .onBeforeHandle(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      return UNAUTHENTICATED;
    }

    const [me] = await db
      .select({ roles: schema.users.roles, status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id))
      .limit(1);

    // `effectiveRoles` already empties an archived or alumni account, so an archived admin
    // loses access immediately even with a live session cookie.
    const allowed = me && effectiveRoles({ roles: me.roles, status: me.status }).includes("admin");
    if (!allowed) {
      set.status = 403;
      logEvent("admin.forbidden", { userId: session.user.id });
      return envelope("FORBIDDEN", "Admin access required.");
    }
    actors.set(request, session.user.id);
  })

  /* ----- overview ----- */
  .get("/overview", async () => {
    const season = await currentSeason();

    const byRole = await db.execute<{ role: string; n: number }>(
      sql`select r as role, count(*)::int as n from "user", unnest("user"."roles") as r group by r`,
    );
    const byStatus = await db
      .select({ status: schema.users.status, n: count() })
      .from(schema.users)
      .groupBy(schema.users.status);
    const [totals] = await db.select({ n: count() }).from(schema.users);

    const pendingWhere = and(
      eq(schema.users.status, "active"),
      sql`${schema.users.roles} @> ARRAY['pending']::"role"[]`,
      sql`${schema.users.profileCompletedAt} is not null`,
    );
    const [pending] = await db.select({ n: count() }).from(schema.users).where(pendingWhere);
    const [pendingMentors] = await db
      .select({ n: count() })
      .from(schema.users)
      .where(and(pendingWhere, eq(schema.users.requestedRole, "mentor")));

    let rosterTotal = 0;
    let rosterClaimed = 0;
    if (season) {
      const [t] = await db
        .select({ n: count() })
        .from(schema.rosterEntries)
        .where(eq(schema.rosterEntries.seasonId, season.id));
      const [c] = await db
        .select({ n: count() })
        .from(schema.rosterEntries)
        .where(
          and(
            eq(schema.rosterEntries.seasonId, season.id),
            sql`${schema.rosterEntries.claimedByUserId} is not null`,
          ),
        );
      rosterTotal = t?.n ?? 0;
      rosterClaimed = c?.n ?? 0;
    }

    const [recent] = await db
      .select({ n: count() })
      .from(schema.auditLog)
      .where(gte(schema.auditLog.createdAt, new Date(Date.now() - 7 * 24 * 3600 * 1000)));

    return adminOverviewSchema.parse({
      membersByRole: Object.fromEntries([...byRole].map((r) => [r.role, r.n])),
      membersByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.n])),
      totalMembers: totals?.n ?? 0,
      pendingMembers: pending?.n ?? 0,
      pendingMentors: pendingMentors?.n ?? 0,
      roster: {
        season: season?.name ?? null,
        total: rosterTotal,
        claimed: rosterClaimed,
        unclaimed: rosterTotal - rosterClaimed,
      },
      recentAudit: recent?.n ?? 0,
    });
  })

  /* ----- members ----- */
  .get("/members", async ({ query }) => {
    const q = parse(adminMembersQuerySchema, query);
    const filters: SQL[] = [];
    if (q.q) {
      const pattern = likePattern(q.q);
      const match = or(ilike(schema.users.name, pattern), ilike(schema.users.email, pattern));
      if (match) filters.push(match);
    }
    if (q.role) filters.push(sql`${schema.users.roles} @> ARRAY[${q.role}]::"role"[]`);
    if (q.status) filters.push(eq(schema.users.status, q.status));
    const where = filters.length > 0 ? and(...filters) : undefined;

    const [total] = await db.select({ n: count() }).from(schema.users).where(where);
    const rows = await db
      .select(memberSelect)
      .from(schema.users)
      .leftJoin(schema.rosterEntries, eq(schema.rosterEntries.id, schema.users.rosterEntryId))
      .where(where)
      .orderBy(desc(schema.users.createdAt))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    return adminMembersResponseSchema.parse({
      items: (rows as MemberSelected[]).map(toMemberRow),
      total: total?.n ?? 0,
      page: q.page,
      limit: q.limit,
    });
  })
  .get("/members/:id", async ({ request, params }) => {
    const id = parse(uuid, params.id);
    const member = await loadMember(id);
    if (!member) throw new HttpError(404, "NOT_FOUND", "No such member.");

    const links = await db
      .select({
        id: schema.rosterEntries.id,
        firstName: schema.rosterEntries.firstName,
        lastName: schema.rosterEntries.lastName,
        grade: schema.rosterEntries.grade,
        relationship: schema.guardianLinks.relationship,
      })
      .from(schema.guardianLinks)
      .innerJoin(
        schema.rosterEntries,
        eq(schema.rosterEntries.id, schema.guardianLinks.rosterEntryId),
      )
      .where(eq(schema.guardianLinks.userId, id));

    return adminMemberDetailSchema.parse({
      ...toMemberRow(member),
      guardianOf: links,
      isSelf: id === actorOf(request),
    });
  })
  .patch("/members/:id", async ({ request, params, body }) => {
    const actor = actorOf(request);
    const id = parse(uuid, params.id);
    const patch = parse(adminMemberPatchSchema, body);

    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({
          roles: schema.users.roles,
          status: schema.users.status,
          requestedRole: schema.users.requestedRole,
        })
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .for("update");
      if (!target) throw new HttpError(404, "NOT_FOUND", "No such member.");

      let roles: Role[] = patch.roles ? [...new Set(patch.roles)] : [...target.roles];
      if (patch.approveMentor) {
        if (target.requestedRole !== "mentor") {
          throw new HttpError(
            400,
            "NOT_A_MENTOR_REQUEST",
            "This person did not ask to be a mentor.",
          );
        }
        roles = ["mentor"];
      }
      // `pending` means "no role yet"; it never sits next to a real role.
      if (roles.length > 1) roles = roles.filter((r) => r !== "pending");
      const status: MemberStatus = patch.status ?? target.status;

      const wasAdmin = target.roles.includes("admin") && target.status === "active";
      const staysAdmin = roles.includes("admin") && status === "active";

      if (id === actor) {
        if (!roles.includes("admin")) {
          throw new HttpError(
            400,
            "CANNOT_REMOVE_OWN_ADMIN",
            "You cannot remove your own admin role.",
          );
        }
        if (status !== "active") {
          throw new HttpError(
            400,
            "CANNOT_ARCHIVE_SELF",
            "You cannot deactivate your own account.",
          );
        }
      }
      if (wasAdmin && !staysAdmin && (await otherActiveAdmins(tx, id)) === 0) {
        throw new HttpError(409, "LAST_ADMIN", "There must always be at least one active admin.");
      }

      await tx.update(schema.users).set({ roles, status }).where(eq(schema.users.id, id));
      await writeAudit(tx, {
        actorUserId: actor,
        action: patch.approveMentor ? "member.mentor_approved" : "member.updated",
        entity: "user",
        entityId: id,
        before: { roles: target.roles, status: target.status },
        after: { roles, status },
      });
      return { roles, status };
    });

    logEvent("admin.member_updated", { actorId: actor, targetId: id });
    const updated = await loadMember(id);
    if (!updated) throw new HttpError(404, "NOT_FOUND", "No such member.");
    return adminMemberDetailSchema.parse({
      ...toMemberRow(updated),
      guardianOf: [],
      isSelf: id === actor,
      ...result,
    });
  })
  .post("/members/:id/revoke-sessions", async ({ request, params }) => {
    const actor = actorOf(request);
    const id = parse(uuid, params.id);

    const revoked = await db.transaction(async (tx) => {
      const [exists] = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1);
      if (!exists) throw new HttpError(404, "NOT_FOUND", "No such member.");

      const deleted = await tx
        .delete(schema.sessions)
        .where(eq(schema.sessions.userId, id))
        .returning({ id: schema.sessions.id });
      await writeAudit(tx, {
        actorUserId: actor,
        action: "member.sessions_revoked",
        entity: "user",
        entityId: id,
        after: { sessions: deleted.length },
      });
      return deleted.length;
    });

    logEvent("admin.sessions_revoked", { actorId: actor, targetId: id, count: revoked });
    return revokeSessionsResponseSchema.parse({ ok: true, revoked });
  })

  /* ----- roster ----- */
  .get("/roster", async ({ query }) => {
    const q = parse(adminRosterQuerySchema, query);
    const season = await currentSeason();
    if (!season) {
      return adminRosterResponseSchema.parse({
        items: [],
        total: 0,
        page: q.page,
        limit: q.limit,
        season: null,
      });
    }
    const endYear = seasonEndYear(season.endsOn);

    const filters: SQL[] = [eq(schema.rosterEntries.seasonId, season.id)];
    if (q.q) {
      const pattern = likePattern(q.q);
      const match = or(
        ilike(schema.rosterEntries.firstName, pattern),
        ilike(schema.rosterEntries.lastName, pattern),
        ilike(
          sql`${schema.rosterEntries.firstName} || ' ' || ${schema.rosterEntries.lastName}`,
          pattern,
        ),
      );
      if (match) filters.push(match);
    }
    if (q.state === "claimed")
      filters.push(sql`${schema.rosterEntries.claimedByUserId} is not null`);
    if (q.state === "unclaimed") filters.push(sql`${schema.rosterEntries.claimedByUserId} is null`);
    const where = and(...filters);

    const [total] = await db.select({ n: count() }).from(schema.rosterEntries).where(where);
    const rows = await db
      .select({
        id: schema.rosterEntries.id,
        firstName: schema.rosterEntries.firstName,
        lastName: schema.rosterEntries.lastName,
        grade: schema.rosterEntries.grade,
        status: schema.rosterEntries.status,
        claimerId: schema.users.id,
        claimerName: schema.users.name,
      })
      .from(schema.rosterEntries)
      .leftJoin(schema.users, eq(schema.users.id, schema.rosterEntries.claimedByUserId))
      .where(where)
      .orderBy(schema.rosterEntries.lastName, schema.rosterEntries.firstName)
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    const items: AdminRosterRow[] = rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      grade: r.grade,
      graduationYear: graduationYearFor(r.grade, endYear),
      status: r.status,
      claimedBy: r.claimerId && r.claimerName ? { id: r.claimerId, name: r.claimerName } : null,
    }));
    return adminRosterResponseSchema.parse({
      items,
      total: total?.n ?? 0,
      page: q.page,
      limit: q.limit,
      season: season.name,
    });
  })
  .post("/roster", async ({ request, body, set }) => {
    const actor = actorOf(request);
    const input = parse(adminRosterCreateSchema, body);
    const season = await currentSeason();
    if (!season) throw new HttpError(409, "NO_SEASON", "There is no current season.");

    const created = await db.transaction(async (tx) => {
      const dupe = await tx
        .select({ id: schema.rosterEntries.id })
        .from(schema.rosterEntries)
        .where(
          and(
            eq(schema.rosterEntries.seasonId, season.id),
            sql`lower(${schema.rosterEntries.firstName}) = lower(${input.firstName})`,
            sql`lower(${schema.rosterEntries.lastName}) = lower(${input.lastName})`,
          ),
        )
        .limit(1);
      if (dupe.length > 0) {
        throw new HttpError(
          409,
          "DUPLICATE_ENTRY",
          "Someone with that name is already on the roster.",
        );
      }
      const [row] = await tx
        .insert(schema.rosterEntries)
        .values({
          seasonId: season.id,
          firstName: input.firstName,
          lastName: input.lastName,
          grade: input.grade ?? null,
        })
        .returning({ id: schema.rosterEntries.id });
      if (!row) throw new Error("insert returned no row");
      await writeAudit(tx, {
        actorUserId: actor,
        action: "roster.created",
        entity: "roster_entry",
        entityId: row.id,
        after: { grade: input.grade ?? null },
      });
      return row.id;
    });

    set.status = 201;
    logEvent("admin.roster_created", { actorId: actor, entryId: created });
    return { ok: true as const, id: created };
  })
  .patch("/roster/:id", async ({ request, params, body }) => {
    const actor = actorOf(request);
    const id = parse(uuid, params.id);
    const patch = parse(adminRosterPatchSchema, body);

    await db.transaction(async (tx) => {
      const [entry] = await tx
        .select()
        .from(schema.rosterEntries)
        .where(eq(schema.rosterEntries.id, id))
        .for("update");
      if (!entry) throw new HttpError(404, "NOT_FOUND", "No such roster entry.");

      const next = {
        firstName: patch.firstName ?? entry.firstName,
        lastName: patch.lastName ?? entry.lastName,
        grade: patch.grade === undefined ? entry.grade : patch.grade,
      };
      const dupe = await tx
        .select({ id: schema.rosterEntries.id })
        .from(schema.rosterEntries)
        .where(
          and(
            eq(schema.rosterEntries.seasonId, entry.seasonId),
            ne(schema.rosterEntries.id, id),
            sql`lower(${schema.rosterEntries.firstName}) = lower(${next.firstName})`,
            sql`lower(${schema.rosterEntries.lastName}) = lower(${next.lastName})`,
          ),
        )
        .limit(1);
      if (dupe.length > 0) {
        throw new HttpError(
          409,
          "DUPLICATE_ENTRY",
          "Someone with that name is already on the roster.",
        );
      }

      await tx.update(schema.rosterEntries).set(next).where(eq(schema.rosterEntries.id, id));
      await writeAudit(tx, {
        actorUserId: actor,
        action: "roster.updated",
        entity: "roster_entry",
        entityId: id,
        before: { grade: entry.grade },
        after: { grade: next.grade },
      });
    });

    logEvent("admin.roster_updated", { actorId: actor, entryId: id });
    return { ok: true as const };
  })
  .post("/roster/:id/unclaim", async ({ request, params }) => {
    const actor = actorOf(request);
    const id = parse(uuid, params.id);

    await db.transaction(async (tx) => {
      const [entry] = await tx
        .select({
          claimedByUserId: schema.rosterEntries.claimedByUserId,
        })
        .from(schema.rosterEntries)
        .where(eq(schema.rosterEntries.id, id))
        .for("update");
      if (!entry) throw new HttpError(404, "NOT_FOUND", "No such roster entry.");
      if (!entry.claimedByUserId) {
        throw new HttpError(409, "NOT_CLAIMED", "That entry is not claimed.");
      }
      const claimant = entry.claimedByUserId;

      await tx
        .update(schema.rosterEntries)
        .set({ claimedByUserId: null, status: "unclaimed" })
        .where(eq(schema.rosterEntries.id, id));
      // The person loses the access the claim gave them and can claim again (D-005). Only the
      // `student` role goes: an admin or parent keeps theirs (D-023).
      const [claimantRow] = await tx
        .select({ roles: schema.users.roles })
        .from(schema.users)
        .where(eq(schema.users.id, claimant))
        .for("update");
      const nextRoles = removeRole((claimantRow?.roles ?? []) as Role[], "student");
      await tx
        .update(schema.users)
        .set({ rosterEntryId: null, roles: nextRoles })
        .where(eq(schema.users.id, claimant));

      await writeAudit(tx, {
        actorUserId: actor,
        action: "roster.unclaimed",
        entity: "roster_entry",
        entityId: id,
        before: { claimed: true },
        after: { claimed: false, roles: nextRoles },
      });
    });

    logEvent("admin.roster_unclaimed", { actorId: actor, entryId: id });
    return { ok: true as const };
  })
  .post("/roster/import", async ({ request, body }) => {
    const actor = actorOf(request);
    const input = parse(adminRosterImportSchema, body);
    const season = await currentSeason();
    if (!season) throw new HttpError(409, "NO_SEASON", "There is no current season.");

    let parsed: ReturnType<typeof parseRosterCsv>;
    try {
      parsed = parseRosterCsv(input.csv);
    } catch (error) {
      if (error instanceof RosterCsvError) throw new HttpError(400, "BAD_CSV", error.message);
      throw error;
    }

    let inserted = 0;
    let updated = 0;
    await db.transaction(async (tx) => {
      for (const p of parsed.people) {
        const [hit] = await tx
          .select({ id: schema.rosterEntries.id })
          .from(schema.rosterEntries)
          .where(
            and(
              eq(schema.rosterEntries.seasonId, season.id),
              sql`lower(${schema.rosterEntries.firstName}) = lower(${p.firstName})`,
              sql`lower(${schema.rosterEntries.lastName}) = lower(${p.lastName})`,
            ),
          )
          .limit(1);
        if (hit) {
          // Never touches claimed_by_user_id or status.
          await tx
            .update(schema.rosterEntries)
            .set({ grade: p.grade })
            .where(eq(schema.rosterEntries.id, hit.id));
          updated += 1;
        } else {
          await tx.insert(schema.rosterEntries).values({
            seasonId: season.id,
            firstName: p.firstName,
            lastName: p.lastName,
            grade: p.grade,
          });
          inserted += 1;
        }
      }
      await writeAudit(tx, {
        actorUserId: actor,
        action: "roster.imported",
        entity: "roster",
        entityId: season.id,
        after: { inserted, updated, skipped: parsed.skipped },
      });
    });

    logEvent("admin.roster_imported", {
      actorId: actor,
      inserted,
      updated,
      skipped: parsed.skipped,
    });
    return adminRosterImportResponseSchema.parse({
      ok: true,
      inserted,
      updated,
      skipped: parsed.skipped,
    });
  })

  /* ----- audit ----- */
  /* ----- core values videos ----- */
  .get("/core-values", async ({ query }) => {
    const q = parse(adminCoreValuesQuerySchema, query);
    const where = q.status ? eq(schema.coreValueSubmissions.status, q.status) : undefined;

    const [total] = await db.select({ n: count() }).from(schema.coreValueSubmissions).where(where);
    const rows = await db
      .select({
        id: schema.coreValueSubmissions.id,
        coreValue: schema.coreValueSubmissions.coreValue,
        status: schema.coreValueSubmissions.status,
        sizeBytes: schema.coreValueSubmissions.sizeBytes,
        durationMs: schema.coreValueSubmissions.durationMs,
        createdAt: schema.coreValueSubmissions.createdAt,
        driveFileId: schema.coreValueSubmissions.driveFileId,
        mimeType: schema.coreValueSubmissions.mimeType,
        studentName: schema.users.name,
      })
      .from(schema.coreValueSubmissions)
      .innerJoin(schema.users, eq(schema.users.id, schema.coreValueSubmissions.userId))
      .where(where)
      .orderBy(desc(schema.coreValueSubmissions.createdAt))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    return adminCoreValuesResponseSchema.parse({
      items: rows.map((r) => ({
        id: r.id,
        coreValue: r.coreValue,
        status: r.status,
        sizeBytes: r.sizeBytes,
        durationMs: r.durationMs,
        createdAt: iso(r.createdAt),
        driveFileId: r.driveFileId,
        mimeType: r.mimeType,
        studentName: r.studentName,
      })),
      total: total?.n ?? 0,
      page: q.page,
      limit: q.limit,
    });
  })

  .patch("/core-values/:id", async ({ request, params, body }) => {
    const actor = actorOf(request);
    const id = parse(uuid, params.id);
    const patch = parse(adminCoreValuePatchSchema, body);

    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: schema.coreValueSubmissions.status })
        .from(schema.coreValueSubmissions)
        .where(eq(schema.coreValueSubmissions.id, id))
        .limit(1);
      if (!current) throw new HttpError(404, "NOT_FOUND", "No such submission.");

      await tx
        .update(schema.coreValueSubmissions)
        .set({ status: patch.status })
        .where(eq(schema.coreValueSubmissions.id, id));
      await writeAudit(tx, {
        actorUserId: actor,
        action: "core_value.reviewed",
        entity: "core_value_submission",
        entityId: id,
        before: { status: current.status },
        after: { status: patch.status },
      });
    });

    logEvent("admin.core_value_reviewed", {
      actorId: actor,
      submissionId: id,
      status: patch.status,
    });
    return { ok: true as const };
  })

  .get("/audit", async ({ query }) => {
    const q = parse(adminAuditQuerySchema, query);
    const where = q.action ? eq(schema.auditLog.action, q.action) : undefined;

    const [total] = await db.select({ n: count() }).from(schema.auditLog).where(where);
    const rows = await db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        entity: schema.auditLog.entity,
        entityId: schema.auditLog.entityId,
        before: schema.auditLog.before,
        after: schema.auditLog.after,
        createdAt: schema.auditLog.createdAt,
        actorName: schema.users.name,
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorUserId))
      .where(where)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    const kinds = await db
      .selectDistinct({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .orderBy(schema.auditLog.action);

    return adminAuditResponseSchema.parse({
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        actorName: r.actorName,
        createdAt: iso(r.createdAt),
        changes: diffFor(r.before, r.after),
      })),
      total: total?.n ?? 0,
      page: q.page,
      limit: q.limit,
      actions: kinds.map((k) => k.action),
    });
  });
