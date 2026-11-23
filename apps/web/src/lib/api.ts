import { apiErrorSchema, meResponseSchema } from "@launchpad/shared";
import { queryOptions } from "@tanstack/react-query";
import type { ZodType } from "zod";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Thin typed fetch wrapper. Same-origin, so the session cookie rides along with no CORS
 * configuration. Eden Treaty is deferred until the route surface stabilises; the shared
 * Zod contracts are the guardrail instead.
 */
export async function apiFetch<T>(
  path: string,
  schema: ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const text = await response.text();
  let payload: unknown;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(response.status, "The server returned an unreadable response.");
    }
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error.message : `Request failed (${response.status}).`,
      parsed.success ? parsed.data.error.code : undefined,
    );
  }

  return schema.parse(payload);
}

/**
 * The session read every authenticated screen shares. A 401 is a normal state, not a
 * retryable failure — the router turns it into a redirect.
 */
export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => apiFetch("/api/me", meResponseSchema),
  staleTime: 30_000,
  retry: (failureCount, error) =>
    !(error instanceof ApiError && error.status === 401) && failureCount < 2,
});
