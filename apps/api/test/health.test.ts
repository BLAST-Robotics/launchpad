import { describe, expect, test } from "bun:test";
import { apiErrorSchema, healthResponseSchema } from "@launchpad/shared";
import { createApp } from "../src/app";

const app = createApp();

function get(path: string, init?: RequestInit) {
  return app.handle(new Request(`http://localhost${path}`, init));
}

describe("GET /api/health", () => {
  test("returns the contract shape and a status that matches db", async () => {
    const response = await get("/api/health");

    // 200 when a database is reachable, 503 when it is not — never anything else.
    expect([200, 503]).toContain(response.status);

    const body = healthResponseSchema.parse(await response.json());
    expect(body.db).toBe(response.status === 200 ? "up" : "down");
    expect(body.ok).toBe(response.status === 200);
    expect(typeof body.version).toBe("string");
    expect(body.commit.length).toBeGreaterThan(0);
  });
});

describe("GET /api/me", () => {
  test("is 401 without a session cookie", async () => {
    const response = await get("/api/me");
    expect(response.status).toBe(401);

    const body = apiErrorSchema.parse(await response.json());
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("does not leak a stack trace in the envelope", async () => {
    const response = await get("/api/me");
    const text = await response.text();

    expect(text).not.toContain("at ");
    expect(text).not.toContain(".ts:");
    expect(text).not.toContain("node_modules");
  });
});

describe("unknown routes", () => {
  test("return a JSON envelope, not HTML", async () => {
    const response = await get("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = apiErrorSchema.parse(await response.json());
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
