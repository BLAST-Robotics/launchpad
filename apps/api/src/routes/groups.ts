import { db, schema } from "@launchpad/db";
import {
  type GroupKey,
  groupsStatusResponseSchema,
  type MemberStatus,
  type Role,
  UNAUTHENTICATED,
} from "@launchpad/shared";
import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { auth } from "../auth";
import { env } from "../env";
import { computeGroupStatuses, createGoogleGroupsClient } from "../lib/groups";

const client = createGoogleGroupsClient(
  env.GOOGLE_SERVICE_ACCOUNT_JSON,
  env.GOOGLE_WORKSPACE_ADMIN_EMAIL,
);

async function lookupGroupEmail(key: GroupKey): Promise<string | null> {
  const row = await db.query.googleObjects.findFirst({
    where: and(eq(schema.googleObjects.kind, "group"), eq(schema.googleObjects.key, key)),
  });
  return row?.email ?? null;
}

/** `GET /api/groups/status`: is the signed-in person in the Google group(s) they should be in. */
export const groupRoutes = new Elysia({ name: "groups" }).get(
  "/api/groups/status",
  async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      return UNAUTHENTICATED;
    }
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.user.id),
    });
    if (!user) {
      set.status = 401;
      return UNAUTHENTICATED;
    }
    const groups = await computeGroupStatuses(
      { client, lookupGroupEmail },
      { email: user.email, roles: user.roles as Role[], status: user.status as MemberStatus },
    );
    return groupsStatusResponseSchema.parse({ groups });
  },
);
