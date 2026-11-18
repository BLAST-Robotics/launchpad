import { Elysia } from "elysia";
import { auth } from "./auth";
import { HttpError } from "./http-error";
import { logError, logEvent } from "./observability";
import { adminRoutes } from "./routes/admin";
import { groupRoutes } from "./routes/groups";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import { onboardingRoutes } from "./routes/onboarding";
import { waiverRoutes } from "./routes/waivers";

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION: 400,
  PARSE: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  UNKNOWN: 500,
};

/**
 * Builds the API. Exported as a factory so tests get an isolated instance and the Vercel
 * entry can reuse the exact same app `bun dev` runs.
 */
export function createApp() {
  return (
    new Elysia({ name: "launchpad" })
      .derive({ as: "global" }, ({ request }) => ({
        requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
        startedAt: performance.now(),
      }))
      .onAfterResponse({ as: "global" }, ({ request, set, requestId, startedAt }) => {
        logEvent("http_request", {
          requestId,
          method: request.method,
          // Path only: query strings can carry tokens or search terms.
          path: new URL(request.url).pathname,
          status: typeof set.status === "number" ? set.status : 200,
          durationMs: Math.round(performance.now() - startedAt),
        });
      })
      .onError({ as: "global" }, ({ code, error, set, requestId }) => {
        // Expected failures thrown by handlers: a stable code and a message meant for people.
        if (error instanceof HttpError) {
          set.status = error.status;
          return { error: { code: error.code, message: error.message, requestId } };
        }
        const status = STATUS_BY_CODE[code] ?? 500;
        // A 500's message may contain internals; it is logged, never returned.
        const message =
          status >= 500
            ? "An unexpected error occurred."
            : (error as Error).message || "Bad request.";

        if (status >= 500) {
          logError(error, { requestId, code });
        }

        set.status = status;
        return {
          error: {
            code: code === "UNKNOWN" || status >= 500 ? "INTERNAL_SERVER_ERROR" : code,
            message,
            requestId,
          },
        };
      })
      // Better Auth owns its whole subtree; the handler is a standard Request → Response.
      .all("/api/auth/*", ({ request }) => auth.handler(request))
      .use(healthRoutes)
      .use(meRoutes)
      .use(onboardingRoutes)
      .use(adminRoutes)
      .use(waiverRoutes)
      .use(groupRoutes)
  );
}

export type App = ReturnType<typeof createApp>;
