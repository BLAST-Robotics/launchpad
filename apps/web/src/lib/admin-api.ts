import {
  type AdminAuditQuery,
  type AdminMemberPatch,
  type AdminMembersQuery,
  type AdminRosterCreate,
  type AdminRosterPatch,
  type AdminRosterQuery,
  adminAuditResponseSchema,
  adminMemberDetailSchema,
  adminMembersResponseSchema,
  adminOverviewSchema,
  adminRosterImportResponseSchema,
  adminRosterResponseSchema,
  revokeSessionsResponseSchema,
} from "@launchpad/shared";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "./api";

/**
 * Typed access to `/api/admin/*`. Reads are TanStack Query options so every screen shares one
 * cache; writes are plain functions that callers wrap in `useMutation` and follow with an
 * invalidation. Nothing here is optimistic: the server is the source of truth.
 */

type Params = Record<string, string | number | undefined>;

function qs(params: Params): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const okSchema = z.object({ ok: z.literal(true) });
const createdSchema = z.object({ ok: z.literal(true), id: z.string().uuid() });
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/** Key prefix: invalidating `["admin"]` refreshes every admin screen after a write. */
export const ADMIN_KEY = ["admin"] as const;

export const overviewQuery = queryOptions({
  queryKey: [...ADMIN_KEY, "overview"],
  queryFn: () => apiFetch("/api/admin/overview", adminOverviewSchema),
});

export const membersQuery = (query: Partial<AdminMembersQuery>) =>
  queryOptions({
    queryKey: [...ADMIN_KEY, "members", query],
    queryFn: () => apiFetch(`/api/admin/members${qs(query as Params)}`, adminMembersResponseSchema),
    placeholderData: (previous) => previous,
  });

export const memberDetailQuery = (id: string) =>
  queryOptions({
    queryKey: [...ADMIN_KEY, "member", id],
    queryFn: () => apiFetch(`/api/admin/members/${id}`, adminMemberDetailSchema),
  });

export const rosterQuery = (query: Partial<AdminRosterQuery>) =>
  queryOptions({
    queryKey: [...ADMIN_KEY, "roster", query],
    queryFn: () => apiFetch(`/api/admin/roster${qs(query as Params)}`, adminRosterResponseSchema),
    placeholderData: (previous) => previous,
  });

export const auditQuery = (query: Partial<AdminAuditQuery>) =>
  queryOptions({
    queryKey: [...ADMIN_KEY, "audit", query],
    queryFn: () => apiFetch(`/api/admin/audit${qs(query as Params)}`, adminAuditResponseSchema),
    placeholderData: (previous) => previous,
  });

export const patchMember = (id: string, patch: AdminMemberPatch) =>
  apiFetch(`/api/admin/members/${id}`, adminMemberDetailSchema, json("PATCH", patch));

export const revokeSessions = (id: string) =>
  apiFetch(
    `/api/admin/members/${id}/revoke-sessions`,
    revokeSessionsResponseSchema,
    json("POST", {}),
  );

export const createRosterEntry = (input: AdminRosterCreate) =>
  apiFetch("/api/admin/roster", createdSchema, json("POST", input));

export const patchRosterEntry = (id: string, patch: AdminRosterPatch) =>
  apiFetch(`/api/admin/roster/${id}`, okSchema, json("PATCH", patch));

export const unclaimRosterEntry = (id: string) =>
  apiFetch(`/api/admin/roster/${id}/unclaim`, okSchema, json("POST", {}));

export const importRoster = (csv: string) =>
  apiFetch("/api/admin/roster/import", adminRosterImportResponseSchema, json("POST", { csv }));
