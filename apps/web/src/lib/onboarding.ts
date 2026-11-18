import {
  type MatchesResponse,
  matchesResponseSchema,
  type OnboardingRequest,
  type OnboardingResponse,
  onboardingResponseSchema,
} from "@launchpad/shared";
import { apiFetch } from "./api";

/**
 * The typed name travels in the query string only because the API defines the lookup as a
 * GET. It is built here, fetched, and never rendered into a link or pushed to history.
 */
export function fetchRosterMatches(input: {
  name: string;
  graduationYear?: number | undefined;
}): Promise<MatchesResponse> {
  const params = new URLSearchParams({ name: input.name.trim() });
  if (input.graduationYear !== undefined) {
    params.set("graduationYear", String(input.graduationYear));
  }
  return apiFetch(`/api/onboarding/matches?${params.toString()}`, matchesResponseSchema);
}

export function submitOnboarding(body: OnboardingRequest): Promise<OnboardingResponse> {
  return apiFetch("/api/onboarding", onboardingResponseSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Admin-only (enforced by the API): finish the welcome step without picking a role. */
export function skipOnboarding(): Promise<OnboardingResponse> {
  return apiFetch("/api/onboarding/skip", onboardingResponseSchema, { method: "POST" });
}
