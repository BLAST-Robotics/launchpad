import { pingDb } from "@launchpad/db";
import { healthResponseSchema } from "@launchpad/shared";
import { Elysia } from "elysia";

const version = process.env.npm_package_version ?? "0.0.0";
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

/**
 * Meaningful on purpose: a 200 is proof the function can reach Postgres over the pooler,
 * not just that the process started. 503 otherwise, so the first deploy's health check
 * fails loudly.
 */
export const healthRoutes = new Elysia({ name: "health" }).get("/api/health", async ({ set }) => {
  const dbUp = await pingDb();
  if (!dbUp) set.status = 503;

  return healthResponseSchema.parse({
    ok: dbUp,
    db: dbUp ? "up" : "down",
    version,
    commit,
  });
});
