import { describe, expect, test } from "bun:test";
import {
  apiErrorSchema,
  matchesQuerySchema,
  matchesResponseSchema,
  onboardingRequestSchema,
} from "@launchpad/shared";
import { createApp } from "../src/app";

const app = createApp();
const call = (path: string, init?: RequestInit) =>
  app.handle(new Request(`http://localhost${path}`, init));

describe("onboarding routes require a session", () => {
  test("GET /api/onboarding/matches is 401", async () => {
    const response = await call("/api/onboarding/matches?name=Maya%20Patel");
    expect(response.status).toBe(401);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  test("POST /api/onboarding is 401", async () => {
    const response = await call("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "mentor", name: "Pat Mentor" }),
    });
    expect(response.status).toBe(401);
  });
});

describe("onboardingRequestSchema", () => {
  test("a student without a graduation year is rejected", () => {
    const result = onboardingRequestSchema.safeParse({ role: "student", name: "Maya Patel" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["graduationYear"]);
  });

  test("a student with a graduation year passes", () => {
    expect(
      onboardingRequestSchema.safeParse({
        role: "student",
        name: "Maya Patel",
        graduationYear: 2028,
      }).success,
    ).toBe(true);
  });

  test("parents and mentors need no graduation year", () => {
    expect(onboardingRequestSchema.safeParse({ role: "parent", name: "Pat Parent" }).success).toBe(
      true,
    );
    expect(onboardingRequestSchema.safeParse({ role: "mentor", name: "Pat Mentor" }).success).toBe(
      true,
    );
  });

  test("rejects short names, unknown roles and out-of-range years", () => {
    expect(onboardingRequestSchema.safeParse({ role: "mentor", name: "P" }).success).toBe(false);
    expect(onboardingRequestSchema.safeParse({ role: "admin", name: "Pat Admin" }).success).toBe(
      false,
    );
    expect(
      onboardingRequestSchema.safeParse({
        role: "student",
        name: "Maya Patel",
        graduationYear: 1999,
      }).success,
    ).toBe(false);
  });
});

describe("match contracts", () => {
  test("the query needs a name of two letters", () => {
    expect(matchesQuerySchema.safeParse({ name: "M" }).success).toBe(false);
    expect(matchesQuerySchema.safeParse({ name: "Maya", graduationYear: "2028" }).success).toBe(
      true,
    );
  });

  test("a response is capped at three matches", () => {
    const entry = {
      id: "6f1d3b7e-3f5c-4f66-9d3e-0a4d1d8f2b11",
      firstName: "A",
      lastName: "B",
      grade: "11",
      graduationYear: 2028,
      claimed: false,
    };
    expect(matchesResponseSchema.safeParse({ matches: [entry, entry, entry] }).success).toBe(true);
    expect(matchesResponseSchema.safeParse({ matches: [entry, entry, entry, entry] }).success).toBe(
      false,
    );
  });
});
