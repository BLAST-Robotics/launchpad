import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { signBody, verifySignature } from "../src/lib/hmac";

const SECRET = "test-webhook-secret-test-secret";
const app = createApp();

const call = (path: string, init?: RequestInit) =>
  app.handle(new Request(`http://localhost${path}`, init));

describe("verifySignature", () => {
  const body = JSON.stringify({ event: "document.completed" });

  test("accepts a correct signature, with or without the sha256= prefix", () => {
    const header = signBody(SECRET, body);
    expect(verifySignature(SECRET, body, header)).toBe(true);
    expect(verifySignature(SECRET, body, header.replace("sha256=", ""))).toBe(true);
  });

  test("rejects a wrong secret", () => {
    expect(verifySignature(SECRET, body, signBody("another-secret-another-secret", body))).toBe(
      false,
    );
  });

  test("fails closed when the secret is not configured", () => {
    expect(verifySignature(undefined, body, signBody(SECRET, body))).toBe(false);
    expect(verifySignature("", body, signBody(SECRET, body))).toBe(false);
  });

  test("rejects a tampered body", () => {
    const header = signBody(SECRET, body);
    expect(verifySignature(SECRET, `${body} `, header)).toBe(false);
  });

  test("rejects a missing or malformed header", () => {
    expect(verifySignature(SECRET, body, null)).toBe(false);
    expect(verifySignature(SECRET, body, "sha256=nothex")).toBe(false);
    expect(verifySignature(SECRET, body, "sha256=abcd")).toBe(false);
  });
});

describe("POST /api/webhooks/keysign", () => {
  const post = (body: string, signature?: string) =>
    call("/api/webhooks/keysign", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(signature ? { "x-keysign-signature": signature } : {}),
      },
      body,
    });

  test("401 with no signature header", async () => {
    expect((await post("{}")).status).toBe(401);
  });

  test("401 with a wrong signature, and the response leaks no detail", async () => {
    const res = await post("{}", signBody("wrong-secret-wrong-secret-xx", "{}"));
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).not.toContain(SECRET);
  });

  test("a valid signature over invalid JSON is a 400", async () => {
    const raw = "not json";
    expect((await post(raw, signBody(SECRET, raw))).status).toBe(400);
  });

  test("a valid signature over an unrecognised payload is a 422", async () => {
    const raw = JSON.stringify({ event: "something.else" });
    expect((await post(raw, signBody(SECRET, raw))).status).toBe(422);
  });
});

describe("waiver routes need a session", () => {
  test("GET /api/waivers/signing is 401 signed out", async () => {
    expect((await call("/api/waivers/signing")).status).toBe(401);
  });

  test("POST /api/waivers/self-report is 401 signed out", async () => {
    expect((await call("/api/waivers/self-report", { method: "POST" })).status).toBe(401);
  });
});
