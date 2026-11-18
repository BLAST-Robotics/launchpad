import postgres from "postgres";
import "../packages/db/scripts/load-env";
import { createTokenSource, GoogleApiError } from "../apps/api/src/lib/google-auth";

/**
 * One command that answers "why is this Google feature not on?" without printing a secret,
 * an address or a Drive/group ID.
 *
 *   bun run db:check-google
 *
 * Checks, in order:
 *   1. the service-account key parses;
 *   2. Google accepts the key (Drive token);
 *   3. whether the service account can see any Shared Drive at all;
 *   4. the registered upload destination (`folder`/`core-values`, else `shared_drive`/`drives.team`)
 *      exists and the account may add files to it;
 *   5. Google accepts a Groups token with the admin impersonation, and each group in
 *      `google_objects` is visible to it.
 *
 * Exit code 1 when any check fails, so it can gate a deploy check later.
 * Run it locally: the Vercel values are stored as secrets and cannot be pulled back.
 */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const GROUPS_SCOPE = "https://www.googleapis.com/auth/admin.directory.group.member.readonly";

type Outcome = { ok: boolean; line: string };

const outcomes: Outcome[] = [];
const record = (ok: boolean, line: string): void => {
  outcomes.push({ ok, line });
  console.log(`${ok ? "ok  " : "FAIL"}  ${line}`);
};

function failReason(error: unknown): string {
  if (error instanceof GoogleApiError) {
    if (error.status === 401)
      return "401 — the key was rejected (delegation or scope not authorized)";
    if (error.status === 403) return "403 — no permission for this API or object";
    if (error.status === 404) return "404 — not found, or not visible to the service account";
    return String(error.status);
  }
  return error instanceof Error ? error.message : "unknown error";
}

const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL;

console.log("Google configuration check\n");

const hasKey = (() => {
  if (!keyJson) return false;
  try {
    const parsed = JSON.parse(keyJson) as { client_email?: unknown; private_key?: unknown };
    return typeof parsed.client_email === "string" && typeof parsed.private_key === "string";
  } catch {
    return false;
  }
})();
record(hasKey, "service-account key parses");

const driveToken = createTokenSource({ keyJson, scope: DRIVE_SCOPE });
let driveOk = false;
if (!driveToken) {
  record(false, "Drive token: no usable key");
} else {
  try {
    await driveToken();
    driveOk = true;
    record(true, "Drive token: Google accepted the key");
  } catch (error) {
    record(false, `Drive token: ${failReason(error)}`);
  }
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("\nDATABASE_URL_UNPOOLED is not set, so google_objects cannot be read.");
  process.exit(1);
}
const client = postgres(url, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });

interface GoogleObjectRow {
  kind: string;
  key: string;
  external_id: string;
  email: string | null;
}
let objects: GoogleObjectRow[] = [];
try {
  objects = await client<GoogleObjectRow[]>`
    select kind::text as kind, key, external_id, email from google_objects
  `;
} finally {
  await client.end({ timeout: 5 });
}

const find = (kind: string, key: string) => objects.find((o) => o.kind === kind && o.key === key);

async function driveGet(path: string): Promise<unknown> {
  const token = driveToken ? await driveToken() : null;
  if (!token) return null;
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new GoogleApiError(path, response.status);
  return response.json();
}

if (driveOk) {
  try {
    const body = (await driveGet("drives?pageSize=50&fields=drives(id)")) as {
      drives?: unknown[];
    } | null;
    const count = body?.drives?.length ?? 0;
    record(
      count > 0,
      count > 0
        ? `Shared Drives visible to the service account: ${count}`
        : "Shared Drives visible to the service account: none — add it as a member (Content manager)",
    );
  } catch (error) {
    record(false, `Shared Drive list: ${failReason(error)}`);
  }

  const folder = find("folder", "core-values");
  const sharedDrive = find("shared_drive", "drives.team");
  const parent = folder ?? sharedDrive;
  if (!parent) {
    record(
      false,
      "upload destination: not registered — set folder/core-values or shared_drive/drives.team",
    );
  } else {
    try {
      const body = (await driveGet(
        `files/${encodeURIComponent(parent.external_id)}?supportsAllDrives=true&fields=id,capabilities(canAddChildren)`,
      )) as { capabilities?: { canAddChildren?: boolean } } | null;
      const canWrite = body?.capabilities?.canAddChildren === true;
      record(
        canWrite,
        canWrite
          ? `upload destination (${parent.kind}/${parent.key}): reachable and writable`
          : `upload destination (${parent.kind}/${parent.key}): visible but read-only — give the service account Content manager`,
      );
    } catch (error) {
      record(false, `upload destination (${parent.kind}/${parent.key}): ${failReason(error)}`);
    }
  }
}

const groups = objects.filter((o) => o.kind === "group");
if (groups.length === 0) {
  record(false, "groups: no group rows in google_objects");
}

const groupsToken = createTokenSource({ keyJson, scope: GROUPS_SCOPE, subject: adminEmail });
let groupsOk = false;
if (!groupsToken) {
  record(false, "Groups token: no usable key");
} else {
  try {
    const token = await groupsToken();
    groupsOk = true;
    record(true, "Groups token: Google accepted the key with the admin impersonation");
    for (const group of groups) {
      const response = await fetch(
        `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(
          group.external_id,
        )}/hasMember/${encodeURIComponent(adminEmail ?? "")}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.ok) {
        record(true, `group/${group.key}: visible to the Groups API`);
      } else if (response.status === 404) {
        record(
          false,
          `group/${group.key}: 404 — the address is not a group in this Workspace, or not visible to it`,
        );
      } else {
        record(
          false,
          `group/${group.key}: ${failReason(new GoogleApiError("hasMember", response.status))}`,
        );
      }
    }
  } catch (error) {
    record(false, `Groups token: ${failReason(error)}`);
  }
}
if (!groupsOk && adminEmail) {
  console.log(
    "      impersonation is on; authorize domain-wide delegation for the service-account client ID",
  );
}

const failed = outcomes.filter((o) => !o.ok).length;
console.log(`\n${outcomes.length - failed} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
