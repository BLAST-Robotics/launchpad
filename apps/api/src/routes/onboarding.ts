import { db, schema } from "@launchpad/db";
import {
  type MatchesResponse,
  matchesQuerySchema,
  matchesResponseSchema,
  matchRoster,
  mergeRoles,
  onboardingRequestSchema,
  onboardingResponseSchema,
  type Role,
  UNAUTHENTICATED,
} from "@launchpad/shared";
import { and, eq, isNull } from "drizzle-orm";
import { Elysia } from "elysia";
import { writeAudit } from "../audit";
import { auth } from "../auth";
import { logEvent } from "../observability";

class Conflict extends Error {
  constructor(readonly code: "ALREADY_ONBOARDED" | "ALREADY_CLAIMED" | "INVALID_ROSTER_ENTRY") {
    super(code);
  }
}

const CONFLICT_MESSAGES: Record<Conflict["code"], string> = {
  ALREADY_ONBOARDED: "Your profile is already set up.",
  ALREADY_CLAIMED: "Someone has already claimed that roster entry. Ask an admin if this is you.",
  INVALID_ROSTER_ENTRY: "That roster entry is not part of the current season.",
};

async function currentSeason() {
  return (await db.query.seasons.findFirst({ where: eq(schema.seasons.isCurrent, true) })) ?? null;
}

function seasonEndYear(value: string | Date): number {
  return value instanceof Date ? value.getUTCFullYear() : Number.parseInt(value.slice(0, 4), 10);
}

/**
 * Post-sign-in profile step.
 *
 * Roles are never self-granted. A student claim or a parent link is the gate (D-005);
 * a mentor, or anyone without a match, stays `pending` until an admin acts.
 */
export const onboardingRoutes = new Elysia({ name: "onboarding" })
  .get("/api/onboarding/matches", async ({ request, query, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      return UNAUTHENTICATED;
    }

    const parsed = matchesQuerySchema.safeParse(query);
    if (!parsed.success) {
      set.status = 400;
      return { error: { code: "VALIDATION", message: "Enter a name of at least 2 letters." } };
    }

    const season = await currentSeason();
    if (!season) {
      const empty: MatchesResponse = { matches: [] };
      return matchesResponseSchema.parse(empty);
    }

    const entries = await db.query.rosterEntries.findMany({
      where: eq(schema.rosterEntries.seasonId, season.id),
    });

    const matches = matchRoster(
      parsed.data.name,
      entries.map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        grade: e.grade,
        claimed: e.claimedByUserId !== null,
      })),
      { graduationYear: parsed.data.graduationYear, seasonEndYear: seasonEndYear(season.endsOn) },
    );

    // Only the DTO fields leave the server: no score, no claimant.
    return matchesResponseSchema.parse({
      matches: matches.map(({ score: _score, ...match }) => match),
    });
  })
  .post("/api/onboarding/skip", async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      return UNAUTHENTICATED;
    }
    const userId = session.user.id;

    // Server-enforced: only an active admin may skip the welcome questions (D-023).
    const result = await db.transaction(async (tx) => {
      const [me] = await tx
        .select({
          roles: schema.users.roles,
          status: schema.users.status,
          done: schema.users.profileCompletedAt,
        })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .for("update");
      if (me?.status !== "active" || !(me.roles as Role[]).includes("admin")) {
        return "forbidden" as const;
      }
      if (me.done !== null) return "already" as const;
      await tx
        .update(schema.users)
        .set({ profileCompletedAt: new Date() })
        .where(eq(schema.users.id, userId));
      await writeAudit(tx, {
        actorUserId: userId,
        action: "member.onboarding_skipped",
        entity: "user",
        entityId: userId,
      });
      return "ok" as const;
    });

    if (result === "forbidden") {
      set.status = 403;
      return { error: { code: "FORBIDDEN", message: "Only admins can skip this step." } };
    }
    if (result === "already") {
      set.status = 409;
      return { error: { code: "ALREADY_ONBOARDED", message: CONFLICT_MESSAGES.ALREADY_ONBOARDED } };
    }
    logEvent("onboarding.skipped", { userId });
    return onboardingResponseSchema.parse({ ok: true, outcome: "pending" });
  })
  .post("/api/onboarding", async ({ request, body, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      return UNAUTHENTICATED;
    }

    const parsed = onboardingRequestSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return {
        error: {
          code: "VALIDATION",
          message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
        },
      };
    }
    const input = parsed.data;
    const userId = session.user.id;
    const season = await currentSeason();

    try {
      const outcome = await db.transaction(async (tx) => {
        const [me] = await tx
          .select({ done: schema.users.profileCompletedAt, existingRoles: schema.users.roles })
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .for("update");
        if (!me || me.done !== null) throw new Conflict("ALREADY_ONBOARDED");

        let result: "claimed" | "linked" | "pending" = "pending";
        // Merge, never replace: an admin can also be a student or a parent (D-023).
        const existingRoles = me.existingRoles as Role[];
        let roles: Role[] = existingRoles.length > 0 ? [...existingRoles] : ["pending"];
        let rosterEntryId: string | null = null;

        if (input.rosterEntryId && (input.role === "student" || input.role === "parent")) {
          const entry = season
            ? await tx.query.rosterEntries.findFirst({
                where: and(
                  eq(schema.rosterEntries.id, input.rosterEntryId),
                  eq(schema.rosterEntries.seasonId, season.id),
                ),
              })
            : undefined;
          if (!entry) throw new Conflict("INVALID_ROSTER_ENTRY");

          if (input.role === "student") {
            // Atomic: the null guard plus the unique claim column mean two simultaneous
            // claims resolve to exactly one winner.
            const claimed = await tx
              .update(schema.rosterEntries)
              .set({ claimedByUserId: userId, status: "claimed" })
              .where(
                and(
                  eq(schema.rosterEntries.id, entry.id),
                  isNull(schema.rosterEntries.claimedByUserId),
                ),
              )
              .returning({ id: schema.rosterEntries.id });
            if (claimed.length === 0) throw new Conflict("ALREADY_CLAIMED");
            roles = mergeRoles(existingRoles, ["student"]);
            rosterEntryId = entry.id;
            result = "claimed";
            await writeAudit(tx, {
              actorUserId: userId,
              action: "member.claimed",
              entity: "roster_entry",
              entityId: entry.id,
              after: { claimed: true },
            });
          } else {
            await tx
              .insert(schema.guardianLinks)
              .values({ userId, rosterEntryId: entry.id, relationship: "parent" })
              .onConflictDoNothing();
            roles = mergeRoles(existingRoles, ["parent"]);
            result = "linked";
            await writeAudit(tx, {
              actorUserId: userId,
              action: "member.guardian_linked",
              entity: "roster_entry",
              entityId: entry.id,
            });
          }
        }

        await tx
          .update(schema.users)
          .set({
            name: input.name,
            graduationYear: input.role === "student" ? (input.graduationYear ?? null) : null,
            requestedRole: input.role,
            profileCompletedAt: new Date(),
            roles,
            rosterEntryId,
          })
          .where(eq(schema.users.id, userId));
        await writeAudit(tx, {
          actorUserId: userId,
          action: "member.onboarded",
          entity: "user",
          entityId: userId,
          after: { requestedRole: input.role, roles },
        });

        return result;
      });

      logEvent("onboarding.completed", { userId, role: input.role, outcome });
      return onboardingResponseSchema.parse({ ok: true, outcome });
    } catch (error) {
      if (error instanceof Conflict) {
        set.status = 409;
        logEvent("onboarding.conflict", { userId, code: error.code });
        return { error: { code: error.code, message: CONFLICT_MESSAGES[error.code] } };
      }
      throw error;
    }
  });
