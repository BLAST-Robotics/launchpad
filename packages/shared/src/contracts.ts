import { z } from "zod";
import { MEMBER_STATUSES, ROLES, ROSTER_STATUSES } from "./roles";
import { duesStatusSchema, waiverStatusSchema } from "./waivers";

/**
 * Wire contracts shared by the API and the SPA. The server validates and the client
 * parses, so the two cannot drift silently.
 */

export const roleSchema = z.enum(ROLES);
export const memberStatusSchema = z.enum(MEMBER_STATUSES);
export const rosterStatusSchema = z.enum(ROSTER_STATUSES);

const isoDateTime = z.string().datetime({ offset: true });
const isoDate = z.string().date();

export const seasonSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  startsOn: isoDate,
  endsOn: isoDate,
  isCurrent: z.boolean(),
});
export type SeasonSummary = z.infer<typeof seasonSummarySchema>;

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  db: z.enum(["up", "down"]),
  version: z.string(),
  commit: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const ONBOARDING_ROLES = ["student", "parent", "mentor"] as const;
export const onboardingRoleSchema = z.enum(ONBOARDING_ROLES);
export type OnboardingRole = z.infer<typeof onboardingRoleSchema>;

const rosterSummarySchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  grade: z.string().nullable(),
});

/** A linked child with the two status cards a parent sees. */
export const childStatusSchema = rosterSummarySchema.extend({
  dues: duesStatusSchema,
  waiver: waiverStatusSchema,
});
export type ChildStatus = z.infer<typeof childStatusSchema>;

export const meResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  roles: z.array(roleSchema),
  effectivePermissions: z.array(z.string()),
  status: memberStatusSchema,
  rosterEntryId: z.string().uuid().nullable(),
  rosterEntry: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      grade: z.string().nullable(),
      status: rosterStatusSchema,
    })
    .nullable(),
  season: seasonSummarySchema.nullable(),
  profileComplete: z.boolean(),
  requestedRole: onboardingRoleSchema.nullable(),
  graduationYear: z.number().int().nullable(),
  /** Children a parent has linked. Valid whether or not the student has claimed. */
  guardianOf: z.array(childStatusSchema),
  /** Own status cards; null for people without a claimed roster entry (parents, mentors). */
  dues: duesStatusSchema.nullable(),
  waiver: waiverStatusSchema.nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const rosterMatchSchema = rosterSummarySchema.extend({
  graduationYear: z.number().int().nullable(),
  /** True when someone already holds this entry. Never says who. */
  claimed: z.boolean(),
});
export type RosterMatchDto = z.infer<typeof rosterMatchSchema>;

export const matchesResponseSchema = z.object({ matches: z.array(rosterMatchSchema).max(3) });
export type MatchesResponse = z.infer<typeof matchesResponseSchema>;

export const matchesQuerySchema = z.object({
  name: z.string().trim().min(2).max(80),
  graduationYear: z.coerce.number().int().min(2025).max(2040).optional(),
});

const graduationYearSchema = z.number().int().min(2025).max(2040);

export const onboardingRequestSchema = z
  .object({
    role: onboardingRoleSchema,
    name: z.string().trim().min(2).max(80),
    graduationYear: graduationYearSchema.optional(),
    rosterEntryId: z.string().uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === "student" && value.graduationYear === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["graduationYear"],
        message: "Graduation year is required for students.",
      });
    }
  });
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;

export const onboardingResponseSchema = z.object({
  ok: z.literal(true),
  /** What the request resulted in: a claim, a guardian link, or a pending account. */
  outcome: z.enum(["claimed", "linked", "pending"]),
});
export type OnboardingResponse = z.infer<typeof onboardingResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

/**
 * The one shape `/api/me` uses when the caller has no session. The SPA owns navigation,
 * so this is a 401 envelope rather than a redirect.
 */
export const UNAUTHENTICATED: ApiErrorBody = {
  error: { code: "UNAUTHENTICATED", message: "Sign in required." },
};

export { isoDateTime };
