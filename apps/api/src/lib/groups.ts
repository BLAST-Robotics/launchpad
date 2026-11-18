import {
  expectedGroupKeys,
  type GroupKey,
  type GroupState,
  type MemberStatus,
  type Role,
} from "@launchpad/shared";
import { classifyGoogleError, createTokenSource, GoogleApiError } from "./google-auth";

/**
 * Read-only Google Groups membership check.
 *
 * Needs a service account key (docs/SETUP.md): either assign the account an admin role, or
 * set an admin to impersonate via domain-wide delegation. Without the key the client is `null`
 * and every check reports `not_connected`. Group emails
 * come from `google_objects` through `lookupGroupEmail`, never from source (D-019).
 * Nothing in here logs an email address or the key.
 */
export interface GroupsClient {
  /** True when `memberEmail` belongs to `groupEmail`. Throws on any Google error. */
  isMember(groupEmail: string, memberEmail: string): Promise<boolean>;
}

const SCOPE = "https://www.googleapis.com/auth/admin.directory.group.member.readonly";

/**
 * Signed-JWT + fetch against Google, no SDK. Returns null when the key is not configured.
 * With `adminEmail` set the client impersonates that admin (domain-wide delegation); without
 * it the client acts as the service account itself, which works once a Workspace admin has
 * assigned the account an admin role (docs/SETUP.md, option A).
 */
export function createGoogleGroupsClient(
  keyJson: string | undefined,
  adminEmail: string | undefined,
  fetchImpl: typeof fetch = fetch,
): GroupsClient | null {
  const accessToken = createTokenSource({ keyJson, scope: SCOPE, subject: adminEmail, fetchImpl });
  if (!accessToken) return null;

  return {
    async isMember(groupEmail, memberEmail) {
      const url = `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(
        groupEmail,
      )}/hasMember/${encodeURIComponent(memberEmail)}`;
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${await accessToken()}` },
      });
      if (!response.ok) throw new GoogleApiError("hasMember", response.status);
      const body = (await response.json()) as { isMember?: boolean };
      return body.isMember === true;
    },
  };
}

const CACHE_MS = 5 * 60 * 1000;

export interface GroupCheckDeps {
  client: GroupsClient | null;
  /** The email for a logical group key, from `google_objects`; null when no row exists. */
  lookupGroupEmail(key: GroupKey): Promise<string | null>;
  /** Called with a safe reason (never an address) when a Google call fails, for logging. */
  onError?: (reason: "forbidden" | "unauthorized" | "not_found" | "other") => void;
  now?: () => number;
  cache?: Map<string, { state: GroupState; expiresAt: number }>;
}

const sharedCache = new Map<string, { state: GroupState; expiresAt: number }>();

/**
 * One state per group the person should be in. Fails soft: any error becomes `unknown`
 * and the page still renders. Results are cached in memory for five minutes.
 */
export async function computeGroupStatuses(
  deps: GroupCheckDeps,
  person: { email: string; roles: readonly Role[]; status: MemberStatus },
): Promise<Array<{ key: GroupKey; state: GroupState }>> {
  const now = deps.now ?? Date.now;
  const cache = deps.cache ?? sharedCache;
  const keys = expectedGroupKeys(person.roles, person.status);

  return Promise.all(
    keys.map(async (key) => {
      let groupEmail: string | null;
      try {
        groupEmail = await deps.lookupGroupEmail(key);
      } catch {
        return { key, state: "unknown" as const };
      }
      if (!groupEmail) return { key, state: "not_configured" as const };
      if (!deps.client) return { key, state: "not_connected" as const };

      const cacheKey = `${groupEmail.toLowerCase()}|${person.email.toLowerCase()}`;
      const hit = cache.get(cacheKey);
      if (hit && hit.expiresAt > now()) return { key, state: hit.state };

      try {
        const isMember = await deps.client.isMember(groupEmail, person.email);
        const state: GroupState = isMember ? "member" : "not_member";
        cache.set(cacheKey, { state, expiresAt: now() + CACHE_MS });
        return { key, state };
      } catch (error) {
        deps.onError?.(classifyGoogleError(error));
        return { key, state: "unknown" as const };
      }
    }),
  );
}
