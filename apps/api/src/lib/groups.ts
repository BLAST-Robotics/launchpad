import { createSign } from "node:crypto";
import {
  expectedGroupKeys,
  type GroupKey,
  type GroupState,
  type MemberStatus,
  type Role,
} from "@launchpad/shared";

/**
 * Read-only Google Groups membership check.
 *
 * Needs a service account with domain-wide delegation (docs/SETUP.md). Until the two env
 * vars are set the client is `null` and every check reports `not_connected`. Group emails
 * come from `google_objects` through `lookupGroupEmail`, never from source (D-019).
 * Nothing in here logs an email address or the key.
 */
export interface GroupsClient {
  /** True when `memberEmail` belongs to `groupEmail`. Throws on any Google error. */
  isMember(groupEmail: string, memberEmail: string): Promise<boolean>;
}

const SCOPE = "https://www.googleapis.com/auth/admin.directory.group.member.readonly";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function parseKey(raw: string): ServiceAccountKey | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>;
    if (typeof parsed.client_email === "string" && typeof parsed.private_key === "string") {
      return parsed as ServiceAccountKey;
    }
  } catch {
    // Unreadable JSON is treated as "not connected", never echoed.
  }
  return null;
}

/** Signed-JWT + fetch against Google, no SDK. Returns null when not configured. */
export function createGoogleGroupsClient(
  keyJson: string | undefined,
  adminEmail: string | undefined,
  fetchImpl: typeof fetch = fetch,
): GroupsClient | null {
  if (!keyJson || !adminEmail) return null;
  const key = parseKey(keyJson);
  if (!key) return null;

  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (token && token.expiresAt - 60 > now) return token.value;

    const aud = key?.token_uri ?? DEFAULT_TOKEN_URI;
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(
      JSON.stringify({
        iss: key?.client_email,
        sub: adminEmail,
        scope: SCOPE,
        aud,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signature = createSign("RSA-SHA256")
      .update(`${header}.${claims}`)
      .sign(key?.private_key ?? "");
    const assertion = `${header}.${claims}.${b64url(signature)}`;

    const response = await fetchImpl(aud, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) throw new Error(`token request failed (${response.status})`);
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error("token response had no access_token");
    token = { value: body.access_token, expiresAt: now + (body.expires_in ?? 3600) };
    return token.value;
  }

  return {
    async isMember(groupEmail, memberEmail) {
      const url = `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(
        groupEmail,
      )}/hasMember/${encodeURIComponent(memberEmail)}`;
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${await accessToken()}` },
      });
      if (!response.ok) throw new Error(`hasMember failed (${response.status})`);
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
      } catch {
        return { key, state: "unknown" as const };
      }
    }),
  );
}
