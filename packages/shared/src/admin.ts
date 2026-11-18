import { z } from "zod";
import { memberStatusSchema, roleSchema, rosterStatusSchema } from "./contracts";

/**
 * Wire contracts for the admin area. Every route behind `/api/admin` requires a session
 * with the `admin` role; the SPA guard is a convenience, the API is the boundary.
 */

const isoDateTime = z.string().datetime({ offset: true });

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

function paged<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
  });
}

/* ---------- overview ---------- */

export const adminOverviewSchema = z.object({
  membersByRole: z.record(z.string(), z.number().int()),
  membersByStatus: z.record(z.string(), z.number().int()),
  totalMembers: z.number().int(),
  pendingMembers: z.number().int(),
  pendingMentors: z.number().int(),
  roster: z.object({
    season: z.string().nullable(),
    total: z.number().int(),
    claimed: z.number().int(),
    unclaimed: z.number().int(),
  }),
  recentAudit: z.number().int(),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

/* ---------- members ---------- */

export const memberRosterSummarySchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  grade: z.string().nullable(),
});

export const adminMemberRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  roles: z.array(roleSchema),
  status: memberStatusSchema,
  requestedRole: z.enum(["student", "parent", "mentor"]).nullable(),
  graduationYear: z.number().int().nullable(),
  profileComplete: z.boolean(),
  createdAt: isoDateTime,
  lastLoginAt: isoDateTime.nullable(),
  rosterEntry: memberRosterSummarySchema.nullable(),
  guardianOfCount: z.number().int().nonnegative(),
});
export type AdminMemberRow = z.infer<typeof adminMemberRowSchema>;

export const adminMembersQuerySchema = pageQuerySchema.extend({
  q: optionalText(80),
  role: roleSchema.optional(),
  status: memberStatusSchema.optional(),
});
export type AdminMembersQuery = z.infer<typeof adminMembersQuerySchema>;

export const adminMembersResponseSchema = paged(adminMemberRowSchema);
export type AdminMembersResponse = z.infer<typeof adminMembersResponseSchema>;

export const adminMemberDetailSchema = adminMemberRowSchema.extend({
  guardianOf: z.array(memberRosterSummarySchema.extend({ relationship: z.string().nullable() })),
  isSelf: z.boolean(),
});
export type AdminMemberDetail = z.infer<typeof adminMemberDetailSchema>;

export const adminMemberPatchSchema = z
  .object({
    roles: z.array(roleSchema).min(1).max(5).optional(),
    status: memberStatusSchema.optional(),
    /** Approve a pending mentor: sets roles to ['mentor'] when they asked to be one. */
    approveMentor: z.literal(true).optional(),
  })
  .refine((v) => v.roles !== undefined || v.status !== undefined || v.approveMentor, {
    message: "Nothing to change.",
  })
  .refine((v) => !(v.roles !== undefined && v.approveMentor), {
    message: "Choose roles or approve the mentor request, not both.",
  });
export type AdminMemberPatch = z.infer<typeof adminMemberPatchSchema>;

export const revokeSessionsResponseSchema = z.object({
  ok: z.literal(true),
  revoked: z.number().int().nonnegative(),
});
export type RevokeSessionsResponse = z.infer<typeof revokeSessionsResponseSchema>;

/* ---------- roster ---------- */

export const adminRosterRowSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  grade: z.string().nullable(),
  graduationYear: z.number().int().nullable(),
  status: rosterStatusSchema,
  claimedBy: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
});
export type AdminRosterRow = z.infer<typeof adminRosterRowSchema>;

export const adminRosterQuerySchema = pageQuerySchema.extend({
  q: optionalText(80),
  state: z.enum(["all", "claimed", "unclaimed"]).default("all"),
});
export type AdminRosterQuery = z.infer<typeof adminRosterQuerySchema>;

export const adminRosterResponseSchema = paged(adminRosterRowSchema).extend({
  season: z.string().nullable(),
});
export type AdminRosterResponse = z.infer<typeof adminRosterResponseSchema>;

const personName = z.string().trim().min(1, "Enter a name.").max(60);
const gradeText = z
  .string()
  .trim()
  .regex(/^(?:[1-9]|1[0-2])$/, "Grade must be a number from 1 to 12.");

export const adminRosterCreateSchema = z.object({
  firstName: personName,
  lastName: personName,
  grade: gradeText.nullish(),
});
export type AdminRosterCreate = z.infer<typeof adminRosterCreateSchema>;

export const adminRosterPatchSchema = z
  .object({
    firstName: personName.optional(),
    lastName: personName.optional(),
    grade: gradeText.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to change." });
export type AdminRosterPatch = z.infer<typeof adminRosterPatchSchema>;

export const adminRosterImportSchema = z.object({
  csv: z.string().min(1, "Paste or choose a CSV.").max(200_000, "That file is too large."),
});
export type AdminRosterImport = z.infer<typeof adminRosterImportSchema>;

export const adminRosterImportResponseSchema = z.object({
  ok: z.literal(true),
  inserted: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export type AdminRosterImportResponse = z.infer<typeof adminRosterImportResponseSchema>;

/* ---------- audit ---------- */

/** Only these small fields are ever shown as before/after; names, emails and tokens never are. */
export const AUDIT_DIFF_FIELDS = ["roles", "status", "grade", "claimed", "requestedRole"] as const;

export const adminAuditRowSchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  actorName: z.string().nullable(),
  createdAt: isoDateTime,
  changes: z.array(
    z.object({ field: z.string(), from: z.string().nullable(), to: z.string().nullable() }),
  ),
});
export type AdminAuditRow = z.infer<typeof adminAuditRowSchema>;

export const adminAuditQuerySchema = pageQuerySchema.extend({
  action: optionalText(60),
});
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;

export const adminAuditResponseSchema = paged(adminAuditRowSchema).extend({
  actions: z.array(z.string()),
});
export type AdminAuditResponse = z.infer<typeof adminAuditResponseSchema>;
