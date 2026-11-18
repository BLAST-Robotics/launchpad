import { createSign } from "node:crypto";

/**
 * Service-account access tokens for Google APIs: a signed JWT exchanged over fetch, no SDK.
 * Shared by the Groups check and the Drive upload so there is one signing path.
 *
 * With `subject` set, the token acts as that Workspace user (domain-wide delegation). With it
 * unset, the token acts as the service account itself, which works when a Workspace admin has
 * assigned the account an admin role, or when the account is a member of the Shared Drive.
 * Keys and addresses are never logged and never put in an error message.
 */

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** A Google API failure carrying only the status, so callers can classify without leaking. */
export class GoogleApiError extends Error {
  readonly status: number;
  constructor(what: string, status: number) {
    super(`${what} failed (${status})`);
    this.name = "GoogleApiError";
    this.status = status;
  }
}

/** Why a Google call failed, in words safe to log. */
export function classifyGoogleError(
  error: unknown,
): "forbidden" | "unauthorized" | "not_found" | "other" {
  if (error instanceof GoogleApiError) {
    if (error.status === 403) return "forbidden";
    if (error.status === 401) return "unauthorized";
    if (error.status === 404) return "not_found";
  }
  return "other";
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export function parseServiceAccountKey(raw: string | undefined): ServiceAccountKey | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>;
    if (typeof parsed.client_email === "string" && typeof parsed.private_key === "string") {
      return parsed as ServiceAccountKey;
    }
  } catch {
    // Unreadable JSON is "not connected", never echoed.
  }
  return null;
}

export type TokenSource = () => Promise<string>;

export function createTokenSource(options: {
  keyJson: string | undefined;
  scope: string;
  /** Workspace user to impersonate (domain-wide delegation). Omit to act as the service account. */
  subject?: string | undefined;
  fetchImpl?: typeof fetch;
}): TokenSource | null {
  const key = parseServiceAccountKey(options.keyJson);
  if (!key) return null;
  const fetchImpl = options.fetchImpl ?? fetch;
  let cached: { value: string; expiresAt: number } | null = null;

  return async () => {
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.expiresAt - 60 > now) return cached.value;

    const aud = key.token_uri ?? DEFAULT_TOKEN_URI;
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(
      JSON.stringify({
        iss: key.client_email,
        ...(options.subject ? { sub: options.subject } : {}),
        scope: options.scope,
        aud,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key.private_key);
    const assertion = `${header}.${claims}.${b64url(signature)}`;

    const response = await fetchImpl(aud, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) throw new GoogleApiError("token request", response.status);
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new GoogleApiError("token response", 502);
    cached = { value: body.access_token, expiresAt: now + (body.expires_in ?? 3600) };
    return cached.value;
  };
}
