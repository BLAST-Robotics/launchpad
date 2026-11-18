import { describe, expect, test } from "bun:test";
import { duesStatusSchema, keysignWebhookSchema, waiverStatus } from "./waivers";

const doc = (id: string, audienceRoles: ("student" | "parent")[] = [], isRequired = true) => ({
  id,
  audienceRoles,
  isRequired,
});
const base = { roles: ["student"] as const, assumedSigned: false, onRoster: true };

describe("waiverStatus", () => {
  test("no applicable document means not required", () => {
    expect(waiverStatus({ ...base, documents: [], signatures: [] }).status).toBe("not_required");
    expect(
      waiverStatus({ ...base, documents: [doc("a", ["parent"])], signatures: [] }).status,
    ).toBe("not_required");
    expect(waiverStatus({ ...base, documents: [doc("a", [], false)], signatures: [] }).status).toBe(
      "not_required",
    );
  });

  test("an unsigned required document is missing", () => {
    const r = waiverStatus({ ...base, documents: [doc("a")], signatures: [] });
    expect(r).toEqual({ status: "missing", missingDocumentIds: ["a"] });
  });

  test("a KeySign signature makes it signed", () => {
    const r = waiverStatus({
      ...base,
      documents: [doc("a")],
      signatures: [{ waiverDocumentId: "a", source: "keysign" }],
    });
    expect(r.status).toBe("signed");
  });

  test("a self-reported signature is labelled as such", () => {
    const r = waiverStatus({
      ...base,
      documents: [doc("a")],
      signatures: [{ waiverDocumentId: "a", source: "self_reported" }],
    });
    expect(r.status).toBe("self_reported");
  });

  test("a KeySign signature beats a self-report on the same document", () => {
    const r = waiverStatus({
      ...base,
      documents: [doc("a")],
      signatures: [
        { waiverDocumentId: "a", source: "self_reported" },
        { waiverDocumentId: "a", source: "keysign" },
      ],
    });
    expect(r.status).toBe("signed");
  });

  test("every applicable document must be covered", () => {
    const r = waiverStatus({
      ...base,
      documents: [doc("a"), doc("b", ["student"])],
      signatures: [{ waiverDocumentId: "a", source: "keysign" }],
    });
    expect(r).toEqual({ status: "missing", missingDocumentIds: ["b"] });
  });

  test("the temporary assumption never counts as a real signature", () => {
    const assumed = waiverStatus({
      ...base,
      assumedSigned: true,
      documents: [doc("a")],
      signatures: [],
    });
    expect(assumed.status).toBe("signed_assumed");
    expect(assumed.missingDocumentIds).toEqual(["a"]);
  });

  test("the assumption only applies to people on the roster", () => {
    const r = waiverStatus({
      ...base,
      assumedSigned: true,
      onRoster: false,
      documents: [doc("a")],
      signatures: [],
    });
    expect(r.status).toBe("missing");
  });

  test("a real signature beats the assumption", () => {
    const r = waiverStatus({
      ...base,
      assumedSigned: true,
      documents: [doc("a")],
      signatures: [{ waiverDocumentId: "a", source: "keysign" }],
    });
    expect(r.status).toBe("signed");
  });
});

describe("contracts", () => {
  test("dues status is a closed set", () => {
    expect(duesStatusSchema.safeParse("paid").success).toBe(true);
    expect(duesStatusSchema.safeParse("partial").success).toBe(false);
  });

  test("webhook payload needs an event, ids and ISO time", () => {
    const ok = {
      event: "document.completed",
      signatureId: "sig_1",
      completedAt: "2026-11-18T01:00:00Z",
      metadata: {
        launchpadUserId: "11111111-1111-4111-8111-111111111111",
        waiverDocumentId: "22222222-2222-4222-8222-222222222222",
      },
    };
    expect(keysignWebhookSchema.safeParse(ok).success).toBe(true);
    expect(keysignWebhookSchema.safeParse({ ...ok, event: "other" }).success).toBe(false);
    expect(keysignWebhookSchema.safeParse({ ...ok, metadata: {} }).success).toBe(false);
  });
});
