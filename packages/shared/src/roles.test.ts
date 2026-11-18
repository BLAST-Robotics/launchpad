import { describe, expect, test } from "bun:test";
import { adminGrantFor, isListedEmail, mergeRoles, parseEmailList, removeRole } from "./roles";

describe("mergeRoles", () => {
  test("keeps admin when a student claim is added", () => {
    expect(mergeRoles(["admin"], ["student"])).toEqual(["admin", "student"]);
  });
  test("unions admin + parent + student without duplicates", () => {
    const merged = mergeRoles(mergeRoles(["admin", "parent"], ["student"]), ["parent"]);
    expect([...merged].sort()).toEqual(["admin", "parent", "student"]);
  });
  test("drops pending once a real role exists, keeps it when alone", () => {
    expect(mergeRoles(["pending"], ["student"])).toEqual(["student"]);
    expect(mergeRoles(["pending"], [])).toEqual(["pending"]);
    expect(mergeRoles([], [])).toEqual(["pending"]);
  });
});

describe("removeRole", () => {
  test("unclaim removes only student and keeps admin and parent", () => {
    expect([...removeRole(["admin", "parent", "student"], "student")].sort()).toEqual([
      "admin",
      "parent",
    ]);
  });
  test("restores pending only when nothing is left", () => {
    expect(removeRole(["student"], "student")).toEqual(["pending"]);
    expect(removeRole(["admin"], "student")).toEqual(["admin"]);
  });
});

describe("email allowlist", () => {
  const list = parseEmailList(" Boss@Example.test, other@example.test ,, ");
  test("parses, trims and lowercases", () => {
    expect(list).toEqual(["boss@example.test", "other@example.test"]);
    expect(parseEmailList(undefined)).toEqual([]);
  });
  test("matches case-insensitively", () => {
    expect(isListedEmail("BOSS@example.test", list)).toBe(true);
    expect(isListedEmail("nobody@example.test", list)).toBe(false);
    expect(isListedEmail(null, list)).toBe(false);
  });
});

describe("adminGrantFor", () => {
  const base = {
    hasGoogleAccount: true,
    emailVerified: true,
    email: "Boss@example.test",
    roles: ["pending"] as const,
    adminEmails: ["boss@example.test"],
  };
  test("grants admin on a verified Google sign-in and merges existing roles", () => {
    expect(adminGrantFor(base)).toEqual(["admin"]);
    expect([...(adminGrantFor({ ...base, roles: ["parent"] }) ?? [])].sort()).toEqual([
      "admin",
      "parent",
    ]);
  });
  test("never grants to password or unverified users", () => {
    expect(adminGrantFor({ ...base, hasGoogleAccount: false })).toBeNull();
    expect(adminGrantFor({ ...base, emailVerified: false })).toBeNull();
  });
  test("never grants to an address that is not listed", () => {
    expect(adminGrantFor({ ...base, email: "stranger@example.test" })).toBeNull();
  });
  test("is idempotent when admin is already held", () => {
    expect(adminGrantFor({ ...base, roles: ["admin", "student"] })).toBeNull();
  });
});
