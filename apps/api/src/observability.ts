import { env } from "./env";

/**
 * One seam for error reporting, so Sentry can be swapped for OTel without touching routes.
 *
 * Phase 0 does not install an SDK: the SENTRY_DSN variable is reserved and the platform's
 * built-in function logs cover a deploy that must not depend on a third account
 * (PHASE-0-PLAN §10). When the SDK lands, `initSentry` is the only function that changes.
 */
let sentryConfigured = false;

export function initSentry(): void {
  if (!env.SENTRY_DSN) return;
  sentryConfigured = true;
  logEvent("observability.sentry_configured", { transport: "deferred" });
}

/**
 * Structured log line. IDs only: no names, emails, tokens, cookies or provider payloads.
 * `fields` is deliberately flat and low-cardinality.
 */
export function logEvent(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };
  if (sentryConfigured) line.sentry = "enabled";
  console.log(JSON.stringify(line));
}

/**
 * Server-side error log for the API boundary. The stack is logged here and nowhere else;
 * the HTTP response never carries it.
 */
export function logError(
  error: unknown,
  context: Record<string, string | number | undefined> = {},
): void {
  const name = error instanceof Error ? error.name : "UnknownError";
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: "unhandled_error",
      name,
      stack,
      ...context,
    }),
  );
}
