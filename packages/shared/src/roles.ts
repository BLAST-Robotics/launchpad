/**
 * Roles, member status, permissions and the pure functions that derive
 * effective access and desired Google Groups membership.
 *
 * No database access, no framework imports — safe in the browser and on the server.
 */

export const ROLES = ["pending", "student", "parent", "mentor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const MEMBER_STATUSES = ["active", "alumni", "archived"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const ROSTER_STATUSES = ["unclaimed", "claimed", "alumni", "archived"] as const;
export type RosterStatus = (typeof ROSTER_STATUSES)[number];

export const PERMISSIONS = [
  "profile:read",
  "profile:edit",
  "claim:create",
  "roster:read",
  "roster:write",
  "attendance:read",
  "attendance:override",
  "waiver:read",
  "waiver:sign-off",
  "event:read",
  "event:write",
  "announcement:read",
  "announcement:write",
  "subteam:read",
  "guardian:read",
  "guardian:manage",
  "sibling:switch",
  "admin:manage",
  "audit:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Capability per role. A user can hold several roles (a mentor can also be a parent),
 * so effective permissions are the union of each held role's statements.
 *
 * `admin` is a superset by construction; it is never self-service.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  pending: ["profile:read", "profile:edit", "claim:create"],
  student: [
    "profile:read",
    "profile:edit",
    "waiver:read",
    "event:read",
    "announcement:read",
    "subteam:read",
  ],
  parent: [
    "profile:read",
    "profile:edit",
    "waiver:read",
    "event:read",
    "announcement:read",
    "guardian:read",
    "guardian:manage",
    "sibling:switch",
  ],
  mentor: [
    "profile:read",
    "claim:create",
    "roster:read",
    "attendance:read",
    "attendance:override",
    "waiver:read",
    "waiver:sign-off",
    "event:read",
    "event:write",
    "announcement:read",
    "announcement:write",
    "subteam:read",
    "guardian:read",
  ],
  admin: [...PERMISSIONS],
};

/**
 * Alumni keep read-only access to their own history and team announcements.
 * They lose every parent capability (sibling selector, guardian records, contact notes)
 * even when a guardian link still exists — see ARCHITECTURE §4 and DECISIONS D-012.
 */
export const ALUMNI_PERMISSIONS: readonly Permission[] = [
  "profile:read",
  "profile:edit",
  "waiver:read",
  "event:read",
  "announcement:read",
  "subteam:read",
];

export interface EffectiveAccessInput {
  roles: readonly Role[];
  status: MemberStatus;
}

/**
 * Roles that actually confer capability.
 *
 * - `archived`: no capabilities at all.
 * - `alumni`: no role-based capability; read-only access comes from ALUMNI_PERMISSIONS.
 * - otherwise: the roles as stored.
 */
export function effectiveRoles(input: EffectiveAccessInput): Role[] {
  if (input.status === "archived") return [];
  if (input.status === "alumni") return [];
  return [...new Set(input.roles.length > 0 ? input.roles : (["pending"] as Role[]))];
}

/** Union of the roles' permissions, then the alumni downgrade. */
export function effectivePermissions(input: EffectiveAccessInput): Permission[] {
  if (input.status === "archived") return [];
  if (input.status === "alumni") return [...ALUMNI_PERMISSIONS];

  const permissions = new Set<Permission>();
  for (const role of effectiveRoles(input)) {
    for (const permission of ROLE_PERMISSIONS[role]) permissions.add(permission);
  }
  return [...permissions];
}

export function hasPermission(input: EffectiveAccessInput, permission: Permission): boolean {
  return effectivePermissions(input).includes(permission);
}

/**
 * Logical Google Groups keys, not email addresses.
 *
 * Group emails live in `google_objects` and are read through a lookup (DECISIONS D-019);
 * nothing in source or the database may hardcode `students@…`. Phase 2 maps these keys
 * to real objects. When a group is missing from `google_objects` the desired state is
 * "unknown" and provisioning reports drift rather than guessing.
 */
export type DesiredGroupKey = "students" | "parents" | "mentors" | `subteam:${string}`;

export interface DesiredGroupsInput extends EffectiveAccessInput {
  /** Slugs of subteams the roster entry belongs to. Ignored for parents/alumni. */
  subteamSlugs?: readonly string[];
}

/**
 * ARCHITECTURE §6, as a pure function.
 *
 * - alumni      → parents
 * - parent      → parents
 * - student/mentor → students + their subteam groups
 * - admin       → students + mentors
 */
export function desiredGroups(input: DesiredGroupsInput): DesiredGroupKey[] {
  if (input.status === "archived") return [];

  if (input.status === "alumni" || input.roles.includes("parent")) {
    return ["parents"];
  }

  const groups = new Set<DesiredGroupKey>();

  if (input.roles.includes("admin")) {
    groups.add("students");
    groups.add("mentors");
  } else {
    if (input.roles.includes("student") || input.roles.includes("mentor")) {
      groups.add("students");
    }
    if (input.roles.includes("student")) {
      for (const slug of input.subteamSlugs ?? []) {
        groups.add(`subteam:${slug}`);
      }
    }
  }

  return [...groups].sort();
}

/**
 * Add roles to a person's existing ones without dropping any (an admin can also be a parent
 * and a student). `pending` is dropped as soon as a real role exists.
 */
export function mergeRoles(existing: readonly Role[], add: readonly Role[]): Role[] {
  const merged = [...new Set<Role>([...existing, ...add])];
  const real = merged.filter((role) => role !== "pending");
  return real.length > 0 ? real : ["pending"];
}

/** Remove one role (e.g. `student` when a claim is undone); `pending` only if nothing is left. */
export function removeRole(existing: readonly Role[], role: Role): Role[] {
  const rest = [...new Set(existing)].filter((r) => r !== role);
  return rest.length > 0 ? rest : ["pending"];
}

/** Parse a comma-separated email allowlist: trimmed, lowercased, empties dropped. */
export function parseEmailList(value: string | undefined | null): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0),
    ),
  ];
}

export function isListedEmail(email: string | null | undefined, list: readonly string[]): boolean {
  return !!email && list.includes(email.trim().toLowerCase());
}

export interface AdminGrantInput {
  /** True only when the person signed in with Google (a verified identity). */
  hasGoogleAccount: boolean;
  emailVerified: boolean;
  email: string;
  roles: readonly Role[];
  adminEmails: readonly string[];
}

/**
 * The roles to store after a sign-in, or null when nothing should change. Password sign-up has
 * no email verification (D-021), so only a verified Google identity can ever earn `admin` this way.
 */
export function adminGrantFor(input: AdminGrantInput): Role[] | null {
  if (!input.hasGoogleAccount || !input.emailVerified) return null;
  if (!isListedEmail(input.email, input.adminEmails)) return null;
  if (input.roles.includes("admin")) return null;
  return mergeRoles(input.roles, ["admin"]);
}
