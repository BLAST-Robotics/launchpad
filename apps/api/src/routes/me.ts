import { db, schema } from "@launchpad/db";
import {
  effectivePermissions,
  type MemberStatus,
  meResponseSchema,
  onboardingRoleSchema,
  type Role,
  UNAUTHENTICATED,
} from "@launchpad/shared";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { auth } from "../auth";
import { asDues, waiverStatusForEntry } from "../lib/waivers";

/**
 * `GET /api/me` — the SPA's single session read.
 *
 * Unauthenticated is 401 with a JSON envelope, never a redirect: the SPA owns navigation.
 */
export const meRoutes = new Elysia({ name: "me" }).get("/api/me", async ({ request, set }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    set.status = 401;
    return UNAUTHENTICATED;
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    with: {
      rosterEntry: {
        with: { season: true },
      },
      guardianLinks: { with: { rosterEntry: true } },
    },
  });

  if (!user) {
    // A valid cookie pointing at a deleted row: treat as unauthenticated, not 500.
    set.status = 401;
    return UNAUTHENTICATED;
  }

  const season =
    user.rosterEntry?.season ??
    (await db.query.seasons.findFirst({ where: eq(schema.seasons.isCurrent, true) })) ??
    null;

  const roles = user.roles as Role[];
  const status = user.status as MemberStatus;

  // Status cards. The waiver is derived on every read; the dues value comes from the roster.
  const seasonId = season?.id ?? null;
  const ownWaiver =
    user.rosterEntry && seasonId
      ? await waiverStatusForEntry(seasonId, user.rosterEntry.id, user.rosterEntry.claimedByUserId)
      : null;
  const children = await Promise.all(
    user.guardianLinks.map(async (link) => ({
      id: link.rosterEntry.id,
      firstName: link.rosterEntry.firstName,
      lastName: link.rosterEntry.lastName,
      grade: link.rosterEntry.grade,
      dues: asDues(link.rosterEntry.duesStatus),
      waiver: seasonId
        ? await waiverStatusForEntry(
            link.rosterEntry.seasonId,
            link.rosterEntry.id,
            link.rosterEntry.claimedByUserId,
          )
        : ("missing" as const),
    })),
  );

  return meResponseSchema.parse({
    id: user.id,
    name: user.name,
    email: user.email,
    roles,
    effectivePermissions: effectivePermissions({ roles, status }),
    status,
    rosterEntryId: user.rosterEntry?.id ?? null,
    rosterEntry: user.rosterEntry
      ? {
          id: user.rosterEntry.id,
          firstName: user.rosterEntry.firstName,
          lastName: user.rosterEntry.lastName,
          grade: user.rosterEntry.grade,
          status: user.rosterEntry.status,
        }
      : null,
    profileComplete: user.profileCompletedAt !== null,
    requestedRole: onboardingRoleSchema.safeParse(user.requestedRole).data ?? null,
    graduationYear: user.graduationYear,
    guardianOf: children,
    dues: user.rosterEntry ? asDues(user.rosterEntry.duesStatus) : null,
    waiver: ownWaiver,
    season: season
      ? {
          id: season.id,
          name: season.name,
          startsOn: toIsoDate(season.startsOn),
          endsOn: toIsoDate(season.endsOn),
          isCurrent: season.isCurrent,
        }
      : null,
  });
});

/**
 * The driver may hand back a `date` as a Date at UTC midnight; the contract is `YYYY-MM-DD`.
 */
function toIsoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}
