import { z } from "zod";
import type { MemberStatus, Role } from "./roles";

/**
 * The read-only Google Groups check: which team groups a person should be in, and the
 * states the check can report. No Google access here; the API does the lookup.
 *
 * Group emails are never in source. These keys map to rows in `google_objects` (D-019).
 */
export const GROUP_KEYS = ["students", "parents"] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

/**
 * Students belong in the students group, parents in the parents group. Alumni move to the
 * parents group (ARCHITECTURE §6) and archived people belong in none. Mentors and admins
 * are not part of this check.
 */
export function expectedGroupKeys(roles: readonly Role[], status: MemberStatus): GroupKey[] {
  if (status === "archived") return [];
  if (status === "alumni") return ["parents"];
  const keys: GroupKey[] = [];
  if (roles.includes("student")) keys.push("students");
  if (roles.includes("parent")) keys.push("parents");
  return keys;
}

export const GROUP_STATES = [
  "member",
  "not_member",
  "not_connected",
  "not_configured",
  "unknown",
] as const;
export const groupStateSchema = z.enum(GROUP_STATES);
export type GroupState = (typeof GROUP_STATES)[number];

export const groupsStatusResponseSchema = z.object({
  groups: z.array(z.object({ key: z.enum(GROUP_KEYS), state: groupStateSchema })),
});
export type GroupsStatusResponse = z.infer<typeof groupsStatusResponseSchema>;

/** Plain words for the dashboard. `detail` never promises a reply. */
export function describeGroup(key: GroupKey, state: GroupState): { label: string; detail: string } {
  const name = key === "students" ? "students" : "parents";
  switch (state) {
    case "member":
      return { label: "In the group", detail: `You're in the ${name} group.` };
    case "not_member":
      return {
        label: "Not in the group yet",
        detail: `You're not in the ${name} group yet. Write to admin@team10989.org.`,
      };
    case "not_connected":
      return {
        label: "Not checked yet",
        detail:
          "The group check isn't connected yet, so we can't tell. Nothing is wrong on your end.",
      };
    case "not_configured":
      return {
        label: "Not checked yet",
        detail: `The ${name} group isn't set up in LaunchPad yet.`,
      };
    case "unknown":
      return {
        label: "Couldn't check",
        detail: "We couldn't check right now. Try again in a few minutes.",
      };
  }
}
